"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();
  const [message, setMessage] = useState("");

  const handleRegister = async () => {
    const res = await fetch("http://localhost:8000/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();

    if (res.ok) {
      setMessage("Registrasi berhasil! Mengalihkan ke login...");
      setTimeout(() => router.push("/login"), 1000);
    } else {
      setMessage(data.error || "Gagal register");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
      <div className="w-full max-w-sm bg-white shadow-xl rounded-2xl p-8 border border-blue-100 animate-fadeIn">
        <h1 className="text-2xl font-bold text-blue-700 text-center mb-6">
          Create Account
        </h1>

        {/* USERNAME */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Username
          </label>
          <input
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-300 focus:outline-none"
            placeholder="Enter username"
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>

        {/* PASSWORD */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            type="password"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-300 focus:outline-none"
            placeholder="Create a password"
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {/* REGISTER BUTTON */}
        <button
          onClick={handleRegister}
          className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 transition-all"
        >
          Register
        </button>

        <p classname="text-center mt-4 text-gray-600">{message}</p>

        {/* LINK TO LOGIN */}
        <p className="text-sm mt-4 text-center text-gray-700">
          Sudah punya akun?{" "}
          <span
            onClick={() => router.push("/login")}
            className="text-blue-600 font-medium cursor-pointer hover:underline"
          >
            Login di sini
          </span>
        </p>
      </div>
    </div>
  );
}
