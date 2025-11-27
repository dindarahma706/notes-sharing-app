"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FiTrash2, FiEdit2, FiLogOut } from "react-icons/fi";

export default function NotesPage() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [editingNote, setEditingNote] = useState(null);
  const [editContent, setEditContent] = useState("");
  const router = useRouter();

  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  useEffect(() => {
    if (!token) {
      router.push("/login");
      return;
    }
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    const res = await fetch("http://localhost:8000/notes", {
      headers: { Authorization: "Bearer " + token },
    });

    let data = await res.json();
    if (!Array.isArray(data)) data = [];
    setNotes(data);
    setLoading(false);
  };

  const addNote = async () => {
    if (!content.trim()) return;

    await fetch("http://localhost:8000/notes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({ title: "Note", content }),
    });

    setContent("");
    fetchNotes();
  };

  const openEditModal = (note) => {
    setEditingNote(note);
    setEditContent(note.content);
  };

  const saveEdit = async () => {
    await fetch(`http://localhost:8000/notes/${editingNote.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({ title: "Note", content: editContent }),
    });

    setEditingNote(null);
    setEditContent("");
    fetchNotes();
  };

  const deleteNote = async (id) => {
    await fetch(`http://localhost:8000/notes/${id}`, {
      method: "DELETE",
      headers: { Authorization: "Bearer " + token },
    });
    fetchNotes();
  };

  const logout = () => {
    localStorage.removeItem("token");
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-blue-600 text-xl">
        Loading your notes… ✨
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-blue-200 py-10 relative">

      {/* Logout button */}
      <button
        onClick={logout}
        className="absolute top-6 right-6 bg-white shadow-lg px-4 py-2 rounded-xl 
                   text-blue-600 font-semibold flex items-center gap-2 hover:bg-blue-50"
      >
        <FiLogOut size={18} /> Logout
      </button>

      {/* Header */}
      <h1 className="text-center text-5xl font-bold text-blue-700 drop-shadow mb-10">
        ✧ My Blue Notes ✧
      </h1>

      {/* Add Note */}
      <div className="max-w-2xl mx-auto bg-white/80 backdrop-blur border border-blue-200 shadow-lg p-6 rounded-3xl mb-10 flex items-center gap-3">
        <input
          type="text"
          value={content}
          placeholder="Write something beautiful..."
          onChange={(e) => setContent(e.target.value)}
          className="flex-1 p-4 rounded-2xl border border-blue-300 bg-white/60 placeholder-blue-400 
                     focus:outline-blue-500 shadow-inner"
        />
        <button
          onClick={addNote}
          className="px-6 py-3 bg-blue-600 text-white rounded-2xl shadow-lg hover:bg-blue-700 active:scale-95 transition-all"
        >
          Add ✧
        </button>
      </div>

      {/* Notes Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7 px-6">
        {notes.map((n) => (
          <div
            key={n.id}
            className="bg-white p-5 h-44 rounded-3xl shadow-xl border border-blue-300 
                       transform rotate-[-2deg] hover:rotate-0 transition-all 
                       bg-[url('https://www.transparenttextures.com/patterns/paper-fibers.png')]"
          >
            <p className="text-gray-700 text-lg font-medium whitespace-pre-wrap leading-relaxed">
              {n.content}
            </p>

            {/* Buttons */}
            <div className="flex justify-end mt-4 gap-3">
              <button
                onClick={() => openEditModal(n)}
                className="px-3 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 shadow flex items-center gap-1"
              >
                <FiEdit2 size={16} />
                Edit
              </button>

              <button
                onClick={() => deleteNote(n.id)}
                className="px-3 py-2 bg-red-400 text-white rounded-xl hover:bg-red-500 shadow flex items-center gap-1"
              >
                <FiTrash2 size={16} />
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL EDIT */}
      {editingNote && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fade">
          <div className="bg-white p-8 rounded-2xl shadow-2xl w-96 transform animate-scaleUp">
            <h2 className="text-xl font-bold text-blue-700 mb-4">Edit Note</h2>

            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full h-32 border border-blue-300 rounded-xl p-3 focus:outline-blue-500"
            ></textarea>

            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={() => setEditingNote(null)}
                className="px-4 py-2 bg-gray-300 rounded-xl hover:bg-gray-400"
              >
                Cancel
              </button>

              <button
                onClick={saveEdit}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Animations */}
      <style jsx>{`
        .animate-fade {
          animation: fadeIn 0.2s ease-out;
        }
        .animate-scaleUp {
          animation: scaleUp 0.25s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleUp {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
