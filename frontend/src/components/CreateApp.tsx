import { LuAlignLeft, LuPlus, LuTag, LuX } from "react-icons/lu";
import { useState } from "react";

export interface CreateAppValues {
  name: string;
  description: string;
}

interface CreateAppProps {
  onCancel: () => void;
  onSubmit: (values: CreateAppValues) => void;
  initialValues?: CreateAppValues;
  submitLabel?: string;
}

export function CreateApp({
  onCancel,
  onSubmit,
  initialValues,
  submitLabel = "Create",
}: CreateAppProps) {
  const [values, setValues] = useState<CreateAppValues>(
    initialValues ?? {
      name: "",
      description: "",
    },
  );

  const isValid = values.name.trim() !== "";

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    setValues((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isValid) onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
          <LuTag size={14} className="text-gray-400" />
          Name <span className="text-red-500">*</span>
        </label>
        <input
          name="name"
          type="text"
          value={values.name}
          onChange={handleChange}
          required
          autoFocus
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
          <LuAlignLeft size={14} className="text-gray-400" />
          Description
        </label>
        <textarea
          name="description"
          value={values.description}
          onChange={handleChange}
          rows={3}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 rounded-md border border-gray-300 hover:bg-gray-50 transition-colors"
        >
          <LuX size={14} />
          Cancel
        </button>
        <button
          type="submit"
          disabled={!isValid}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-md bg-gray-900 hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <LuPlus size={14} />
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
