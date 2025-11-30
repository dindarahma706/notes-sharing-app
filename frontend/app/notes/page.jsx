"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FiTrash2, FiEdit2, FiLogOut, FiPlus, FiCopy } from "react-icons/fi";

export default function NotesPage() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  // top modal: choose new or join
  const [showAddChoice, setShowAddChoice] = useState(false);
  // new note
  const [showAddPopup, setShowAddPopup] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newType, setNewType] = useState("note");
  const [newContent, setNewContent] = useState("");

  // join by token
  const [showJoinPopup, setShowJoinPopup] = useState(false);
  const [joinToken, setJoinToken] = useState("");

  // share token modal
  const [sharingNote, setSharingNote] = useState(null);
  const [shareToken, setShareToken] = useState("");

  // edit modal
  const [editingNote, setEditingNote] = useState(null);
  const [editContent, setEditContent] = useState("");

  // delete confirm
  const [confirmDelete, setConfirmDelete] = useState(null);

  const router = useRouter();
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const [title, setTitle] = useState("My Notes");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  useEffect(() => {
  if (!token) {
    router.push("/login");
    return;
  }
  fetchTitle();
  fetchNotes();
}, []);

const fetchTitle = async () => {
  const res = await fetch("http://localhost:8000/title", {
    headers: { Authorization: "Bearer " + token }
  });
  const data = await res.json();
  if (data && data.title) setTitle(data.title);
};


  const fetchNotes = async () => {
    const res = await fetch("http://localhost:8000/notes", {
      headers: { Authorization: "Bearer " + token },
    });
    let data = await res.json();
    if (!Array.isArray(data)) data = [];
    setNotes(data);
    setLoading(false);
  };

  // CREATE new note
  const addNote = async () => {
    if (!newContent.trim()) return;
    await fetch("http://localhost:8000/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ type: newType, content: newContent, date: newDate, status: newType === "todo" ? "on_progress" : null }),
    });
    setNewContent(""); setNewDate(""); setNewType("note"); setShowAddPopup(false); setShowAddChoice(false);
    fetchNotes();
  };

  // JOIN by token
  const joinByToken = async () => {
    if (!joinToken.trim()) return alert("Masukkan token");
    const res = await fetch("http://localhost:8000/notes/join", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ token: joinToken.trim() }),
    });
    const data = await res.json();
    if (res.ok) {
      setShowJoinPopup(false);
      setShowAddChoice(false);
      setJoinToken("");
      fetchNotes();
      alert("Berhasil join note!");
    } else {
      alert(data.error || "Gagal join");
    }
  };

  // generate share token
  const generateShareToken = async (note) => {
    const res = await fetch(`http://localhost:8000/notes/${note.id}/generate_share_token`, {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
    });
    const data = await res.json();
    if (res.ok) {
      setSharingNote(note);
      setShareToken(data.share_token || data.shareToken || data.share_token);
    } else {
      alert(data.error || "Gagal generate token");
    }
  };

  const copyToken = async () => {
    if (!shareToken) return;
    await navigator.clipboard.writeText(shareToken);
    alert("Token copied!");
  };

  // open edit
  const openEditModal = (note) => {
    setEditingNote(note);
    setEditContent(note.content || "");
  };

  const saveEdit = async () => {
    if (!editingNote) return;
    await fetch(`http://localhost:8000/notes/${editingNote.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ content: editContent }),
    });
    setEditingNote(null);
    setEditContent("");
    fetchNotes();
  };

  // delete with confirm
  const confirmDeleteNote = (note) => {
    setConfirmDelete(note);
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    await fetch(`http://localhost:8000/notes/${confirmDelete.id}`, {
      method: "DELETE",
      headers: { Authorization: "Bearer " + token },
    });
    setConfirmDelete(null);
    fetchNotes();
  };

  const updateStatus = async (id, status) => {
    await fetch(`http://localhost:8000/notes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ status }),
    });
    fetchNotes();
  };

  const saveTitle = async () => {
  const res = await fetch("http://localhost:8000/title", {
    method: "PUT",
    headers: { 
      "Content-Type": "application/json",
      Authorization: "Bearer " + token 
    },
    body: JSON.stringify({ title: newTitle })
  });

  if (res.ok) {
    setTitle(newTitle);
    setIsEditingTitle(false);
  } else {
    alert("Gagal update title");
  }
};


  const logout = () => {
    localStorage.removeItem("token");
    router.push("/login");
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-blue-600 text-xl">Loading your notes… ✨</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-blue-200 py-10 relative">
      <button onClick={logout} className="absolute top-6 right-6 bg-white shadow-lg px-4 py-2 rounded-xl text-blue-600 font-semibold flex items-center gap-2 hover:bg-blue-50">
        <FiLogOut size={18} /> Logout
      </button>

      <div className="flex flex-col items-center mb-10 relative">
  {!isEditingTitle ? (
    <div className="relative group">
      <h1 className="text-4xl sm:text-5xl font-bold text-gray-900">
        {title}
      </h1>

      {/* edit icon kanan bawah */}
      <button
        onClick={() => {
          setNewTitle(title);
          setIsEditingTitle(true);
        }}
        className="absolute -right-6 bottom-1 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 transition"
      >
        ✏️
      </button>
    </div>
  ) : (
    <div className="flex items-center gap-3">
      <input
        className="border p-2 rounded-xl"
        value={newTitle}
        onChange={(e) => setNewTitle(e.target.value)}
      />
      <button
        className="px-3 py-1 bg-blue-600 text-white rounded-xl"
        onClick={saveTitle}
      >
        Save
      </button>
      <button
        className="px-3 py-1 bg-gray-300 rounded-xl"
        onClick={() => setIsEditingTitle(false)}
      >
        Cancel
      </button>
    </div>
  )}
</div>


      <div className="flex justify-center mb-8">
        <button onClick={() => setShowAddChoice(true)} className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-2xl shadow-lg hover:bg-blue-700">
          <FiPlus size={20} /> Add New
        </button>
      </div>

      {/* grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7 px-6">
        {notes.map((n) => (
          <div key={n.id} className="p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition">
            <p className="text-sm text-gray-500 mb-1">{n.date}</p>
            <p className="text-gray-800 text-lg font-medium whitespace-pre-wrap leading-relaxed">{n.content}</p>

            { /* status dropdown with color */ }
            <div className="mt-3">
              <select
                className={`mt-1 px-2 py-1 rounded-lg ${n.status === "completed" ? "bg-green-100" : "bg-yellow-100"} border`}
                value={n.status || "on_progress"}
                onChange={(e) => updateStatus(n.id, e.target.value)}
              >
                <option value="on_progress">On Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div className="flex justify-end mt-4 gap-3">
              <button onClick={() => openEditModal(n)} className="px-3 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 flex items-center gap-1">
                <FiEdit2 size={16} /> Edit
              </button>

              <button onClick={() => confirmDeleteNote(n)} className="px-3 py-2 bg-red-400 text-white rounded-xl hover:bg-red-500 flex items-center gap-1">
                <FiTrash2 size={16} /> Delete
              </button>

              <button onClick={() => generateShareToken(n)} className="px-3 py-2 bg-green-500 text-white rounded-xl hover:bg-green-600 flex items-center gap-1">
                Share
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ADD CHOICE MODAL */}
      {showAddChoice && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-6 w-96 rounded-2xl shadow border border-gray-200">
            <h3 className="text-lg font-bold mb-4">Add</h3>
            <div className="flex flex-col gap-3">
              <button onClick={() => { setShowAddPopup(true); setShowAddChoice(false); }} className="py-2 bg-blue-600 text-white rounded">New Note</button>
              <button onClick={() => { setShowJoinPopup(true); setShowAddChoice(false); }} className="py-2 bg-gray-200 rounded">Join by Token</button>
              <button onClick={() => setShowAddChoice(false)} className="mt-3 py-2 bg-gray-300 rounded">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ADD NEW POPUP */}
      {showAddPopup && (
        <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50">
          <div className="bg-white p-6 w-96 rounded-2xl shadow border border-gray-200">
            <h2 className="text-xl font-bold mb-4 text-blue-700">Add New Note</h2>
            <label>Date</label>
            <input type="date" className="w-full border rounded-xl p-2 mb-4" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            <label>Type</label>
            <select className="w-full border rounded-xl p-2 mb-4" value={newType} onChange={(e) => setNewType(e.target.value)}>
              <option value="note">Note</option>
              <option value="todo">To-Do</option>
            </select>
            <label>Content</label>
            <textarea className="w-full border rounded-xl p-3 mb-4 h-24" placeholder="Write here..." value={newContent} onChange={(e) => setNewContent(e.target.value)} />
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowAddPopup(false)} className="px-4 py-2 bg-gray-300 rounded-xl hover:bg-gray-400">Cancel</button>
              <button onClick={addNote} className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700">Add</button>
            </div>
          </div>
        </div>
      )}

      {/* JOIN POPUP */}
      {showJoinPopup && (
        <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50">
          <div className="bg-white p-6 w-96 rounded-2xl shadow border border-gray-200">
            <h2 className="text-xl font-bold mb-4 text-blue-700">Join Note by Token</h2>
            <label>Token</label>
            <input type="text" className="w-full border rounded-xl p-2 mb-4" value={joinToken} onChange={(e) => setJoinToken(e.target.value)} />
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowJoinPopup(false)} className="px-4 py-2 bg-gray-300 rounded-xl hover:bg-gray-400">Cancel</button>
              <button onClick={joinByToken} className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700">Join</button>
            </div>
          </div>
        </div>
      )}

      {/* SHARE TOKEN MODAL */}
      {sharingNote && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-6 w-96 rounded-2xl shadow border border-gray-200">
            <h2 className="text-xl font-bold mb-4 text-blue-700">Share Token</h2>
            <p className="mb-3 break-all">{shareToken}</p>
            <div className="flex justify-between">
              <button onClick={() => { setSharingNote(null); setShareToken(""); }} className="px-4 py-2 bg-gray-300 rounded-xl">Close</button>
              <button onClick={copyToken} className="px-4 py-2 bg-green-600 text-white rounded-xl flex items-center gap-2"><FiCopy /> Copy</button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingNote && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-2xl shadow-xl w-96">
            <h2 className="text-xl font-bold text-blue-700 mb-4">Edit Note</h2>
            <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} className="w-full h-32 border border-blue-300 rounded-xl p-3"></textarea>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setEditingNote(null)} className="px-4 py-2 bg-gray-300 rounded-xl hover:bg-gray-400">Cancel</button>
              <button onClick={saveEdit} className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-6 w-80 rounded-2xl shadow-xl">
            <h3 className="font-bold mb-3">Confirm delete?</h3>
            <p className="text-sm mb-4">Are you sure want to delete this note?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 bg-gray-300 rounded">Cancel</button>
              <button onClick={doDelete} className="px-4 py-2 bg-red-600 text-white rounded">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
