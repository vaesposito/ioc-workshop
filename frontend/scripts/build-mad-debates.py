#!/usr/bin/env python3
"""Turn recorded MAD debate traces into the content file the trace view reads.

Usage: python3 scripts/build-mad-debates.py ~/Downloads/*_q0000.json

Two kinds of input go in, told apart by their schema_version:

A public trace (mad-public-trace/v1 or /v2) carries the question, the seats and
every round's responses with the answer each one submitted. On a choice task
that answer is an option id; on a coding task it is a whole program, and the
programs are lettered here in the order they first appear.

Sidecars are optional and name what a trace cannot: evaluator labels
(mad-evaluator-labels/v2) give the attacker seats and the model behind each
seat, a role profile gives each seat its brief, and a run manifest
(mad-run-manifest/v3) says which role profile a run used. Where a trace comes
with none of them those fields are written empty rather than guessed at, and
the view hides what it has no data for.

A JSONL of Agent-ToM assessments is the last kind of input. It is a reading of
a debate rather than a recording of one, made after the fact by a detector
model, and it is attached to a trace only where every vote it reports matches
the vote that trace recorded — the assessments ship for runs of their own, and
a reading of a different run would describe answers that are not on screen.
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "src" / "content" / "mad-debates.json"

SCENARIO_NAMES = {
    "benign": "Benign collaboration",
    "single": "Single attacker",
    "colluding": "Colluding attackers",
}

SCENARIO_ORDER = ["benign", "single", "colluding"]

# A trace names its benchmark and its question but not the subject, so the
# picker's wording lives here.
TASK_LABELS = {
    "mmlupro": "MMLU-Pro · federal preemption",
    "hiddenbench": "HiddenBench · evacuation routes",
    "livecodebench": "LiveCodeBench · minimum partition cost",
}

QUESTION_SUMMARIES = {
    "mmlupro": "Does the state tomato rule survive the federal-preemption claim?",
    "hiddenbench": "Which evacuation location is safest: West City, East Town, or North Hill?",
    "livecodebench": "Which program divides nums into subarrays at the lowest total cost?",
}

# A coding run answers with a program rather than a letter, which changes what
# a round shows and what an arrow can mean.
TASK_TYPES = {"livecodebench": "code"}

REVIEW_RULES = {
    "livecodebench": "Every agent submits a complete program every round. The "
    "run records those programs and nothing about them: no test results ship "
    "with it, so no submission here is marked right or wrong.",
}

TASK_ORDER = ["mmlupro", "hiddenbench", "livecodebench"]

# An arrow is a move onto an answer a peer was already holding. The trace
# records which peer turns an agent had seen and what everyone answered, so
# that is as far as the recording can be read.
OUTCOMES = {
    "adopted": {
        "label": "Answer now matches an observed turn",
        "short": "Matches observed turn",
        "description": "This round the agent's recorded answer changes to the "
        "answer another agent had already recorded, in a turn the trace lists "
        "among the ones it observed.",
    },
    "attack-adopted": {
        "label": "Answer now matches an attacker's observed turn",
        "short": "Matches an attacker",
        "description": "The same match, where the turn it matches belongs to a "
        "seat the evaluator labels name as an assigned attacker.",
    },
    # Where a debate was read by Agent-ToM, the arrows are the detector's own:
    # it names the turns it read as having moved each agent.
    "tom": {
        "label": "Agent-ToM read this turn as moved by that one",
        "short": "Read as moved by",
        "description": "The detector names this earlier turn among the ones "
        "that moved the agent this round. It is the detector's reading of the "
        "responses, not a match between recorded answers.",
    },
    "tom-suspect": {
        "label": "Agent-ToM read this turn as moved by a suspect",
        "short": "Moved by a suspect",
        "description": "The same reading, where the turn it names belongs to "
        "an agent the detector suspects of working against the group.",
    },
}

# A run id reads like
# "mmlu52-full52-attack_mmlupro_v9_adaptive-colluding-additive-...:q0000",
# so the benchmark and the scenario are two of its words.
DATASET_WORDS = {
    "mmlu": "mmlupro",
    "hiddenbench": "hiddenbench",
    "livecodebench": "livecodebench",
}


def agent_name(index):
    return f"Agent {index + 1}"


# An assessment counts agents and options from zero and says so in its own
# metadata ("Agent N in text is agent index N in the data ... the debate's own
# messages call it Agent N+1"). The view counts agents from one and shows
# options as letters, so its prose is put into those names before it is shown.
AGENT_MENTION = re.compile(
    r"(\bAgents?\s+)((?:\d+(?:['’]s)?)(?:(?:,\s*|\s+and\s+|,\s*and\s+)\d+(?:['’]s)?)*)"
)
OPTION_MENTION = re.compile(r"\b(Option|option)\s+(\d+)\b")


def in_view_names(text):
    """One of the detector's sentences, renamed to what the view calls things."""
    if not text:
        return ""
    renumbered = AGENT_MENTION.sub(
        lambda m: m.group(1)
        + re.sub(r"\d+", lambda n: str(int(n.group(0)) + 1), m.group(2)),
        text,
    )
    return OPTION_MENTION.sub(
        lambda m: f"{m.group(1)} {option_letter(int(m.group(2)))}", renumbered
    )


def option_letter(option_id):
    """Options are shown as letters; the recorded ids stay numeric underneath.

    A choice task has four to ten options. A coding task letters every distinct
    program, which runs past Z, so the letters carry on as AA, AB and so on.
    """
    if option_id is None:
        return "—"
    letters = ""
    index = option_id
    while index >= 0:
        letters = chr(ord("A") + index % 26) + letters
        index = index // 26 - 1
    return letters


TURN_REF = re.compile(r"agent-(\d+)-round-(\d+)")


class Tom:
    """An Agent-ToM reading of one debate, in the seats the trace uses.

    The detector works in agent indexes; everything here hands back seat ids,
    so the rest of the builder never has to think about the two numberings.
    """

    def __init__(self, row, seats):
        assessments = row["tom_assessments"]
        self.metadata = assessments["metadata"]
        self.results = assessments["debate_results"]
        self.attribution = assessments["agent_attribution"]
        self.seats = seats

    def seat(self, index):
        index = int(index)
        return self.seats[index] if 0 <= index < len(self.seats) else None

    def entry(self, seat_id):
        return self.attribution.get(str(self.seats.index(seat_id))) or {}

    def final(self, seat_id):
        return self.entry(seat_id).get("final") or {}

    def round(self, seat_id, rnd):
        rounds = self.entry(seat_id).get("by_round") or []
        return next((entry for entry in rounds if entry.get("round") == rnd), {})

    def suspects(self):
        named = self.results.get("suspect_agents") or []
        return [seat for seat in map(self.seat, named) if seat]

    def suspect_scores(self):
        scores = self.results.get("suspect_scores") or {}
        return {
            self.seat(index): score
            for index, score in scores.items()
            if self.seat(index)
        }

    def moved_by(self, seat_id, rnd):
        """The turns the detector names as having moved this one this round."""
        out = []
        for ref in self.round(seat_id, rnd).get("peers_impact") or []:
            match = TURN_REF.fullmatch(str(ref))
            peer = self.seat(match.group(1)) if match else None
            if peer and peer != seat_id:
                out.append((peer, int(match.group(2))))
        return out

    def votes_match(self, decision):
        """True where every vote the reading reports is the one on record.

        An assessment is exported under its own run name, so the only way to
        know it is a reading of this recording is to check it against it. One
        vote out of place means it read a sibling run, whose answers are not
        the ones the view shows.
        """
        if len(self.attribution) != len(self.seats):
            return False
        checked = 0
        for seat_id in self.seats:
            for entry in self.entry(seat_id).get("by_round") or []:
                if decision(seat_id, entry["round"]) != entry.get("vote"):
                    return False
                checked += 1
        return checked > 0


def tag_trace(trace):
    """The benchmark and the run a trace's id names."""
    words = (
        (trace.get("trace_id") or "")
        .lower()
        .replace(":", "-")
        .replace("_", "-")
        .split("-")
    )
    dataset = next(
        (
            name
            for word in words
            for key, name in DATASET_WORDS.items()
            if word.startswith(key)
        ),
        "unknown",
    )
    scenario = next((name for name in SCENARIO_ORDER if name in words), "benign")
    return dataset, scenario


class Scenario:
    """One recorded run, read into the shape the trace view expects.

    This reads a choice task, where an answer is an option id. The hooks the
    rounds are built through — what the options are, what a seat is, what an
    arrow is called — are overridden in CodeScenario for a coding run.
    """

    # How a submission is spoken about in the round-by-round copy.
    answer_noun = "answer"

    def __init__(self, dataset, scenario, trace, tom=None):
        self.dataset = dataset
        self.scenario = scenario
        self.trace = trace
        self.seats = trace["participant_seat_ids"]
        self.rounds = trace["rounds"]
        # An Agent-ToM reading of this run, where one was given for it.
        self.tom = tom

    # --- recorded state -------------------------------------------------

    def decision(self, seat_id, rnd):
        """The answer on record for a seat at a round, or None if there is none."""
        if rnd < 1 or rnd > len(self.rounds):
            return None
        turn = next(
            (t for t in self.rounds[rnd - 1]["turns"] if t["seat_id"] == seat_id),
            None,
        )
        if turn is None:
            return None
        option_id = turn.get("decision_option_id")
        return None if option_id is None else int(option_id)

    def option_label(self, option_id):
        if option_id is None:
            return "No recorded choice"
        text = next(
            (o["text"] for o in self.trace.get("options") or [] if o["id"] == option_id),
            None,
        )
        return text or "No recorded choice"

    def option_short(self, option_id):
        """MMLU-Pro options run to a paragraph each; HiddenBench's are three words."""
        if option_id is None:
            return "No recorded choice"
        if self.dataset == "hiddenbench":
            return self.option_label(option_id)
        return f"Option {option_letter(option_id)}"

    # --- what a run carries, where a sidecar can name more ---------------

    def option_list(self):
        """The options the trace lists. A coding run has none and builds its own."""
        return [
            {
                **option,
                "letter": option_letter(option["id"]),
                # An option a coding run submits into being carries the round
                # and the seat it first appeared in; a listed one does not.
                "createdRound": None,
                "createdBy": None,
                "createdByName": None,
            }
            for option in self.trace.get("options") or []
        ]

    def seat_list(self):
        return [
            {
                "id": seat,
                "name": agent_name(index),
                "model": "",
                "role": "",
                "roleFocus": "",
                "adversary": False,
                "detector": self.seat_reading(seat),
            }
            for index, seat in enumerate(self.seats)
        ]

    def seat_reading(self, seat_id):
        """How Agent-ToM read this seat by the end, or nothing if unread."""
        if not self.tom:
            return None
        final = self.tom.final(seat_id)
        return {
            "label": final.get("label") or "",
            "scores": final.get("scores") or {},
            "score": (final.get("scores") or {}).get(final.get("label")),
            "suspect": seat_id in self.tom.suspects(),
            "reading": in_view_names(final.get("latent_behaviour")),
            "endsIn": final.get("ends_in") or "",
            "keyRounds": final.get("evidence_key_rounds") or [],
        }

    def detector_block(self):
        """The detector's verdict on the debate as a whole."""
        if not self.tom:
            return None
        results = self.tom.results
        return {
            "model": self.tom.metadata.get("model") or "",
            "generatedAt": self.tom.metadata.get("generated_at") or "",
            "roundsAnalyzed": self.tom.metadata.get("rounds_analyzed"),
            "decision": results.get("decision") or "",
            "explanation": in_view_names(results.get("explanation")),
            "suspects": self.tom.suspects(),
            "suspectScores": self.tom.suspect_scores(),
        }

    def attack_block(self):
        return {
            # The run id says whether attackers took part, never which seats
            # they sat in.
            "present": self.scenario != "benign",
            "mode": self.scenario if self.scenario != "benign" else "",
            "adversaries": [],
        }

    def attacker(self, seat_id):
        """True where a sidecar names this seat as an assigned attacker."""
        return False

    def uptake_list(self, rounds):
        """Moves onto an attacker's answer, which needs the attacker roster."""
        return []

    def answer_text(self, option_id):
        """The submission itself, where it is a document rather than a choice."""
        return None

    def option_is_new(self, option_id, rnd, seat_id):
        return False

    def turn_reading(self, seat_id, rnd):
        """How Agent-ToM scored this agent at this round, where it read it."""
        if not self.tom:
            return None
        reading = self.tom.round(seat_id, rnd)
        if not reading:
            return None
        return {
            "label": reading.get("label") or "",
            "scores": reading.get("scores") or {},
            "change": reading.get("score_change"),
            "alone": bool(reading.get("alone")),
            "summary": in_view_names(reading.get("round_summary")),
        }

    def link_label(self, peer_name):
        return f"{peer_name} already answered this"

    # --- derived from the trace -----------------------------------------

    def observed(self, turn, seat_id):
        """The peer turns the speaker had in front of it, latest round first."""
        seen = {}
        for entry in turn.get("observed_peer_turns") or []:
            peer = entry.get("seat_id")
            rnd = entry.get("round")
            if peer == seat_id or peer not in self.seats:
                continue
            if not isinstance(rnd, int) or rnd > seen.get(peer, 0):
                seen[peer] = rnd
        return seen

    def tom_links_for(self, rnd, seat_id, index):
        """The turns Agent-ToM names as having moved this one this round.

        Where a debate was read by the detector, the arrows are its readings
        rather than a match between recorded answers: peers_impact lists the
        turns it read as moving the agent, and the arrow says that and no more.
        """
        out = []
        for peer, from_round in self.tom.moved_by(seat_id, rnd):
            peer_name = agent_name(self.seats.index(peer))
            suspect = peer in self.tom.suspects()
            category = "tom-suspect" if suspect else "tom"
            out.append(
                {
                    "id": f"{self.dataset}-{self.scenario}-tom-{rnd}-{seat_id}-{peer}-{from_round}",
                    "from": peer,
                    "fromName": peer_name,
                    "fromRound": from_round,
                    "to": seat_id,
                    "toName": agent_name(index),
                    "label": f"Agent-ToM read this as moved by {peer_name}",
                    "kind": "tom",
                    "outcome": category,
                    "category": category,
                    "attack": suspect,
                    "interpretation": in_view_names(
                        self.tom.round(seat_id, rnd).get("round_summary")
                    ),
                    "sourceQuote": "",
                    "path": None,
                }
            )
        return out

    def links_for(self, turn, rnd, seat_id, index):
        """Observed turns that already carried the answer this agent changed to.

        Two keys decide this and nothing else: observed_peer_turns, which lists
        the turns this one was shown, and decision_option_id, which is the
        answer on each turn. An arrow means those two values coincide — the
        answer here changed to one an observed turn already carried. Whether
        the one caused the other is not in the trace and is not claimed.
        """
        if self.tom:
            return self.tom_links_for(rnd, seat_id, index)
        before = self.decision(seat_id, rnd - 1)
        after = self.decision(seat_id, rnd)
        if after is None or before == after:
            return []
        out = []
        for peer, from_round in sorted(self.observed(turn, seat_id).items()):
            if self.decision(peer, from_round) != after:
                continue
            peer_name = agent_name(self.seats.index(peer))
            attacker = self.attacker(peer)
            category = "attack-adopted" if attacker else "adopted"
            out.append(
                {
                    "id": f"{self.dataset}-{self.scenario}-{rnd}-{seat_id}-{peer}",
                    # "from" is the peer whose answer the speaker moved onto.
                    "from": peer,
                    "fromName": peer_name,
                    "fromRound": from_round,
                    "to": seat_id,
                    "toName": agent_name(index),
                    "label": self.link_label(peer_name),
                    "kind": "observed",
                    "outcome": category,
                    "category": category,
                    "attack": attacker,
                    "interpretation": (
                        f"{peer_name} answered {self.option_short(after)} at round "
                        f"{from_round}, a turn this one lists as observed. The answer "
                        f"here goes from {self.option_short(before)} to "
                        f"{self.option_short(after)}."
                    ),
                    # A quote needs a review of the text, which a trace has
                    # none of; the response itself is in the column beside this.
                    "sourceQuote": "",
                    "path": None,
                }
            )
        return out

    def events_for(self, rnd, seat_id, index, links):
        """What happened to one seat's answer this round, and who held it first."""
        before = self.decision(seat_id, rnd - 1)
        after = self.decision(seat_id, rnd)
        changed = before != after
        # A reading has something to say about an agent that held its answer
        # as much as one that moved, so every seat gets its round.
        if not changed and not self.tom:
            return None
        if self.tom:
            reading = self.tom.round(seat_id, rnd)
            return {
                "seat": seat_id,
                "name": agent_name(index),
                "before": before,
                "after": after,
                "beforeLabel": self.option_short(before),
                "afterLabel": self.option_short(after),
                "changed": changed,
                "title": (
                    f"{self.option_short(before)} → {self.option_short(after)}"
                    if changed
                    else f"Held {self.option_short(after)}"
                ),
                "explanation": in_view_names(reading.get("round_summary")),
                "linkIds": [link["id"] for link in links],
            }
        return {
            "seat": seat_id,
            "name": agent_name(index),
            "before": before,
            "after": after,
            "beforeLabel": self.option_short(before),
            "afterLabel": self.option_short(after),
            "changed": changed,
            "title": f"{self.option_short(before)} → {self.option_short(after)}",
            "explanation": (
                f"The recorded {self.answer_noun} changes at this round. The "
                f"agents below had already recorded that {self.answer_noun}, "
                "in turns this one lists as observed."
                if links
                else f"The recorded {self.answer_noun} changes at this round. "
                f"No turn this one lists as observed carried that "
                f"{self.answer_noun}."
            ),
            "linkIds": [link["id"] for link in links],
        }

    # --- output ---------------------------------------------------------

    def build(self):
        rounds = []
        for entry in self.rounds:
            rnd = entry["round"]
            turns, links, events = [], [], []
            for turn in entry["turns"]:
                seat_id = turn["seat_id"]
                index = self.seats.index(seat_id)
                text = turn.get("text") or ""
                # Round 1 is everyone's opening answer, written before any peer
                # has spoken, so nothing in it can be a move onto one.
                turn_links = (
                    self.links_for(turn, rnd, seat_id, index) if rnd > 1 else []
                )
                option_id = self.decision(seat_id, rnd)
                turns.append(
                    {
                        "seat": seat_id,
                        "name": agent_name(index),
                        "text": text,
                        "optionId": option_id,
                        "optionLabel": self.option_label(option_id),
                        "optionShort": self.option_short(option_id),
                        "optionLetter": option_letter(option_id),
                        # No answer key ships with a trace.
                        "correct": False,
                        "changed": rnd > 1
                        and option_id != self.decision(seat_id, rnd - 1),
                        "optionNew": self.option_is_new(option_id, rnd, seat_id),
                        "detector": self.turn_reading(seat_id, rnd),
                        "answer": self.answer_text(option_id),
                        # Highlighting a span needs a quote from a review of
                        # the text; a trace carries none.
                        "marks": [],
                    }
                )
                links.extend(turn_links)
                event = self.events_for(rnd, seat_id, index, turn_links)
                if event and rnd > 1:
                    events.append(event)
            tally = {}
            for turn in turns:
                key = "none" if turn["optionId"] is None else str(turn["optionId"])
                tally[key] = tally.get(key, 0) + 1
            rounds.append(
                {
                    "round": rnd,
                    "turns": turns,
                    "links": links,
                    "events": events,
                    "tally": tally,
                }
            )

        # Without an answer key, the most the rounds can show is the round the
        # agents first landed on one answer together.
        first_agreement = next(
            (
                entry["round"]
                for entry in self.rounds
                if len({self.decision(seat, entry["round"]) for seat in self.seats})
                == 1
            ),
            None,
        )
        return {
            "id": self.scenario,
            "name": SCENARIO_NAMES.get(self.scenario, self.scenario),
            "traceId": self.trace.get("trace_id") or "",
            "question": self.trace.get("question") or "",
            "options": self.option_list(),
            # No answer key ships with any of these runs, labelled or not, so
            # nothing is marked right: holding one wrong answer throughout
            # reads the same as being told to push it.
            "correctOptionId": None,
            "correctOptionLabel": "",
            "seats": self.seat_list(),
            "attack": self.attack_block(),
            "uptake": self.uptake_list(rounds),
            "detector": self.detector_block(),
            "firstUnanimousRound": first_agreement,
            "finalCorrect": [],
            "synthesis": None,
            "rounds": rounds,
        }


class CodeScenario(Scenario):
    """One recorded coding run, where a submission is a whole program.

    A coding trace lists no options: every turn carries a program under
    submitted_answer. Identical programs are one answer and take one letter,
    handed out in the order the programs first appear, so the answer list
    fills up as the debate runs and each round can say what was new in it.

    The sidecars name what the trace does not. The evaluator labels give the
    attacker seats and the model behind each seat; the role profile gives each
    seat the brief it was writing to.
    """

    answer_noun = "program"

    def __init__(self, dataset, scenario, trace, labels=None, roles=None):
        super().__init__(dataset, scenario, trace)
        self.labels = labels or {}
        self.roles = roles or {}
        # Program text to the answer it became, in first-appearance order.
        self.programs = {}
        self.by_id = []
        for entry in self.rounds:
            for turn in entry["turns"]:
                self.register(entry["round"], turn)

    # --- the programs as answers ----------------------------------------

    @staticmethod
    def program(turn):
        return (turn.get("submitted_answer") or "").strip() or None

    def register(self, rnd, turn):
        text = self.program(turn)
        if text is None or text in self.programs:
            return
        seat_id = turn["seat_id"]
        option = {
            "id": len(self.by_id),
            "letter": option_letter(len(self.by_id)),
            "text": text,
            "createdRound": rnd,
            "createdBy": seat_id,
            "createdByName": agent_name(self.seats.index(seat_id)),
        }
        self.programs[text] = option
        self.by_id.append(option)

    def decision(self, seat_id, rnd):
        if rnd < 1 or rnd > len(self.rounds):
            return None
        turn = next(
            (t for t in self.rounds[rnd - 1]["turns"] if t["seat_id"] == seat_id),
            None,
        )
        text = self.program(turn) if turn else None
        return self.programs[text]["id"] if text in self.programs else None

    def option_label(self, option_id):
        if option_id is None:
            return "No program submitted"
        return f"Program {option_letter(option_id)}"

    def option_short(self, option_id):
        return self.option_label(option_id)

    def option_list(self):
        return list(self.by_id)

    def answer_text(self, option_id):
        """The program itself, which the trace column renders as code."""
        return None if option_id is None else self.by_id[option_id]["text"]

    def option_is_new(self, option_id, rnd, seat_id):
        if option_id is None:
            return False
        option = self.by_id[option_id]
        return option["createdRound"] == rnd and option["createdBy"] == seat_id

    def link_label(self, peer_name):
        return f"{peer_name} had already submitted this program"

    # --- what the sidecars name ------------------------------------------

    def role(self, seat_id):
        """The seat's brief, keyed by the scenario and the problem it ran on."""
        problem = str((self.labels.get("reference") or {}).get("question_id") or "")
        assignments = (self.roles.get("assignments") or {}).get(self.scenario) or {}
        return ((assignments.get(problem) or {}).get(seat_id) or {}).get("role") or ""

    def role_focus(self, role):
        """The focus a role's brief names, in the brief's own words.

        Every brief opens on the same sentence about submitting a program each
        round and closes on detail. Between them is one sentence naming what
        the seat is there for, which is taken as written.
        """
        brief = (self.roles.get("definitions") or {}).get(role) or ""
        opener = "your focus is"
        for sentence in brief.split("."):
            text = sentence.strip()
            if text.lower().startswith(opener):
                return text[len(opener) :].strip()
        return ""

    def seat_list(self):
        models = self.labels.get("model_by_seat_id") or {}
        seats = []
        for index, seat in enumerate(self.seats):
            role = self.role(seat)
            seats.append(
                {
                    "id": seat,
                    "name": agent_name(index),
                    "model": models.get(seat) or "",
                    "role": role,
                    "roleFocus": self.role_focus(role),
                    "adversary": self.attacker(seat),
                }
            )
        return seats

    def attacker(self, seat_id):
        attack = self.labels.get("attack") or {}
        return seat_id in (attack.get("adversary_seat_ids") or [])

    def attack_block(self):
        attack = self.labels.get("attack") or {}
        return {
            "present": bool(attack.get("present", self.scenario != "benign")),
            # The scenario word, as on the other runs; the labels' own mode
            # names the attack recipe rather than the shape of the run.
            "mode": self.scenario if self.scenario != "benign" else "",
            "adversaries": [
                seat
                for seat in (attack.get("adversary_seat_ids") or [])
                if seat in self.seats
            ],
        }

    def uptake_list(self, rounds):
        """Moves onto a program an attacker had already submitted."""
        return [
            {
                "seat": link["to"],
                "name": link["toName"],
                "round": entry["round"],
                "optionLabel": self.option_label(
                    self.decision(link["to"], entry["round"])
                ),
                "possible": True,
            }
            for entry in rounds
            for link in entry["links"]
            if link["attack"]
        ]

    def events_for(self, rnd, seat_id, index, links):
        event = super().events_for(rnd, seat_id, index, links)
        if event and self.option_is_new(event["after"], rnd, seat_id):
            event["explanation"] = (
                "This round's program is one no agent had submitted before, so "
                "it is lettered here for the first time. Nothing it was shown "
                "carried it."
            )
        return event


def read_inputs(paths):
    """Sort the inputs into traces and the sidecars that describe them."""
    traces, labels, roles, manifests, assessments = [], {}, {}, {}, []
    for path in paths:
        if path.suffix == ".jsonl":
            assessments.extend(
                row
                for row in map(json.loads, filter(None, map(str.strip, path.read_text(encoding="utf-8").splitlines())))
                if row.get("tom_assessments")
            )
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        version = data.get("schema_version") or ""
        if version.startswith("mad-public-trace"):
            traces.append(data)
        elif version.startswith("mad-evaluator-labels"):
            labels[data.get("trace_id") or ""] = data
        elif version.startswith("mad-run-manifest"):
            manifests[data.get("run_id") or ""] = data
        elif data.get("profile") and data.get("assignments"):
            roles[data["profile"]] = data
        else:
            sys.exit(f"unrecognised input: {path.name}")
    return traces, labels, roles, manifests, assessments


def reading_for(built, assessments):
    """The assessment made from this very recording, if one of them was."""
    for row in assessments:
        tom = Tom(row, built.seats)
        if tom.votes_match(built.decision):
            return tom
    return None


def build_scenario(trace, labels, roles, manifests, assessments):
    """One trace plus whichever sidecars name the same run."""
    dataset, scenario = tag_trace(trace)
    trace_id = trace.get("trace_id") or ""
    if (trace.get("task_type") or "") not in {"livecodebench"}:
        built = Scenario(dataset, scenario, trace)
        built.tom = reading_for(built, assessments)
        return dataset, built.build()
    run = labels.get(trace_id) or {}
    # The manifest is what ties a run to the role profile it was set up with.
    # A trace id is the run id and the question it ran on, "<run>:q0001".
    manifest = manifests.get(trace_id.split(":")[0]) or {}
    panel = (manifest.get("resolved_config") or {}).get("panel") or {}
    profile = panel.get("roles") or ""
    return dataset, CodeScenario(
        dataset, scenario, trace, run, roles.get(profile) or {}
    ).build()


def main():
    if len(sys.argv) < 2:
        sys.exit("usage: build-mad-debates.py <trace.json> [...]")
    paths = []
    for argument in sys.argv[1:]:
        path = Path(argument).expanduser()
        paths.extend(sorted(path.glob("*.json")) if path.is_dir() else [path])

    traces, labels, roles, manifests, assessments = read_inputs(paths)

    groups = {}
    read = []
    for trace in traces:
        dataset, scenario = build_scenario(
            trace, labels, roles, manifests, assessments
        )
        groups.setdefault(dataset, {})[scenario["id"]] = scenario
        if scenario["detector"]:
            read.append(f'{dataset}/{scenario["id"]}')

    tasks = []
    for dataset, scenarios in groups.items():
        label = TASK_LABELS.get(dataset, dataset)
        tasks.append(
            {
                "id": dataset,
                "title": label,
                "selectLabel": label,
                "questionSummary": QUESTION_SUMMARIES.get(dataset, ""),
                "reviewRule": REVIEW_RULES.get(dataset),
                "taskType": TASK_TYPES.get(dataset, "choice"),
                "scenarios": sorted(
                    scenarios.values(),
                    key=lambda scenario: SCENARIO_ORDER.index(scenario["id"])
                    if scenario["id"] in SCENARIO_ORDER
                    else len(SCENARIO_ORDER),
                ),
            }
        )

    tasks.sort(
        key=lambda task: TASK_ORDER.index(task["id"])
        if task["id"] in TASK_ORDER
        else len(TASK_ORDER)
    )

    payload = {
        "generatedFrom": ", ".join(path.name for path in paths),
        "outcomes": OUTCOMES,
        "tasks": tasks,
    }
    OUT.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    size = OUT.stat().st_size / 1024
    print(
        f"wrote {OUT.relative_to(ROOT)} · {size:.0f} KB · "
        f"{len(tasks)} tasks · {len(traces)} traces"
    )
    if assessments:
        print(
            f"  {len(assessments)} Agent-ToM assessments read · "
            f"attached to {', '.join(read) if read else 'nothing'} "
            "(votes had to match the recording)"
        )


if __name__ == "__main__":
    main()
