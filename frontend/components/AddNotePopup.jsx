"use client";
import { useState } from "react";

export default function AddNotePopup({ onClose }) {
  const [type, setType] = useState("note");
  const [date, setDate] = useState("");
  const [content, setContent] = useState("");

  const handleAdd = async () => {
    await fetch("http://localhost:8080/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: type === "todo" ? "To-Do" : "Note",
        content,
        date,
        status: type === "todo" ? "on progress" : null
      })
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex justify-center items-center">
      <div className="bg-white w-96 p-6 rounded-xl shadow-lg">
        <h2 className="text-xl font-bold mb-4">Add Notes</h2>

        {/* Date */}
        <label className="block mb-2">Date</label>
        <input
          type="date"
          className="border w-full p-2 rounded mb-4"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />

        {/* Dropdown */}
        <label className="block mb-2">Type</label>
        <select
          className="border w-full p-2 rounded mb-4"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="todo">To-Do</option>
          <option value="note">Note Biasa</option>
        </select>

        {/* Textbox */}
        <label className="block mb-2">Content</label>
        <textarea
          className="border w-full p-2 rounded mb-4 h-24"
          placeholder={type === "todo" ? "Tuliskan to-do..." : "Tuliskan catatan..."}
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />

        <div className="flex justify-end gap-3">
          <button 
            className="text-gray-600"
            onClick={onClose}
          >
            Cancel
          </button>
          <button 
            className="bg-blue-600 text-white px-4 py-2 rounded-lg"
            onClick={handleAdd}
          >
            Add Notes
          </button>
        </div>
      </div>
    </div>
  );
}
