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
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-400 to-blue-600 p-4">

    <div className="bg-white w-full max-w-md p-8 rounded-2xl shadow-xl relative animate-fadeIn">

      {/* Icon bulat */}
      <div className="flex justify-center -mt-16 mb-6">
        <div className="bg-white shadow-lg p-4 rounded-full">
          <span className="text-blue-600 text-3xl font-bold">✿</span>
        </div>
      </div>

      <h1 className="text-2xl font-bold text-gray-800 text-center mb-6">
        Login
      </h1>

      {/* Username */}
      <label className="text-gray-600 text-sm mb-1 block">Username</label>
      <input
        className="w-full border border-gray-300 p-3 rounded-lg mb-4
                   focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none transition"
        placeholder="Enter your username"
        onChange={(e) => setUsername(e.target.value)}
      />

      {/* Password */}
      <label className="text-gray-600 text-sm mb-1 block">Password</label>
      <input
        type="password"
        className="w-full border border-gray-300 p-3 rounded-lg mb-4
                   focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none transition"
        placeholder="Enter your password"
        onChange={(e) => setPassword(e.target.value)}
      />

      {/* Button */}
      <button
        onClick={handleLogin}
        className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold
                   hover:bg-blue-700 transition-all shadow-md"
      >
        Login
      </button>

      {/* Message */}
      <p className="text-center mt-4 text-gray-700 text-sm">{message}</p>

      {/* Links bawah */}
      <div className="flex justify-between mt-6 text-sm text-gray-600">
        <button className="hover:underline">Forgot Password?</button>
        <button onClick={() => router.push("/register")} className="hover:underline">Register Now</button>
      </div>
    </div>
  </div>
);

}
