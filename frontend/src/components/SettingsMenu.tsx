import { useEffect, useRef, useState } from "react";
import {
  LuCircleUserRound,
  LuFolderTree,
  LuSettings,
  LuUsers,
} from "react-icons/lu";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export function SettingsMenu() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth({ verifyBackendAuth: true });
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function handleNavigate(path: string) {
    setOpen(false);
    navigate(path);
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen((value) => !value)}
        className="p-2 rounded-md text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
        aria-label="Settings menu"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <LuSettings size={18} />
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl border border-gray-200 shadow-xl z-50 overflow-hidden"
          role="menu"
          aria-label="Settings menu"
        >
          <div className="p-1.5">
            <button
              className="w-full flex items-center gap-2 text-left text-sm text-gray-700 hover:bg-gray-100 rounded-lg px-3 py-2 transition-colors"
              role="menuitem"
              onClick={() => handleNavigate("/profile")}
            >
              <LuCircleUserRound size={15} className="text-gray-500" />
              <span>Profile</span>
            </button>
            <button
              className="w-full flex items-center gap-2 text-left text-sm text-gray-700 hover:bg-gray-100 rounded-lg px-3 py-2 transition-colors"
              role="menuitem"
              onClick={() => handleNavigate("/trace-manager")}
            >
              <LuFolderTree size={15} className="text-gray-500" />
              <span>Trace manager</span>
            </button>
            {isAdmin && (
              <button
                className="w-full flex items-center gap-2 text-left text-sm text-gray-700 hover:bg-gray-100 rounded-lg px-3 py-2 transition-colors"
                role="menuitem"
                onClick={() => handleNavigate("/settings/users")}
              >
                <LuUsers size={15} className="text-gray-500" />
                <span>User management</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
