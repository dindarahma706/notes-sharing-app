"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();
  const [message, setMessage] = useState("");

  const handleLogin = async () => {
    const res = await fetch("http://localhost:8000/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();

    if (res.ok) {
      // simpan token
      localStorage.setItem("token", data.token);

      setMessage("Login berhasil! Masuk ke halaman notes...");
      setTimeout(() => router.push("/notes"), 1000);
    } else {
      setMessage(data.error || "Gagal login");
    }
  };

  return (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-300 to-blue-600 relative">
    {/* ICON BUNGA */}
      <div className="absolute top-24 flex justify-center w-full">
        <div className="bg-white p-4 rounded-full shadow-md border border-gray-200">
        <span className="text-3xl">🌼</span>
        </div>
      </div>

    <div className="bg-white p-10 rounded-2xl shadow-lg w-[430px] mt-16 border border-blue-100 animate-fadeIn">
        <h1 className="text-2xl font-bold text-blue-700 text-center mb-6">
          Login
        </h1>

      {/* Username */}
      <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
      <input
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-300 focus:outline-none mb-4"
        placeholder="Enter your username"
        onChange={(e) => setUsername(e.target.value)}
      />

      {/* Password */}
      <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
      <input
        type="password"
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-300 focus:outline-none mb-4"
        placeholder="Enter your password"
        onChange={(e) => setPassword(e.target.value)}
      />

      {/* Button */}
      <button
        onClick={handleLogin}
        className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 transition-all"
      >
        Login
      </button>

      {/* Message */}
      <p className="text-center mt-4 text-gray-600">{message}</p>

      {/* Links bawah */}
      <div className="flex justify-between mt-6 text-sm text-gray-700">
        <button className="hover:underline">Forgot Password?</button>
        <button onClick={() => router.push("/register")} className="hover:underline">Register Now</button>
      </div>
    </div>
  </div>
);

}
