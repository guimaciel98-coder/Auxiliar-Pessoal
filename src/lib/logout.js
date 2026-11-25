// Sai do app: apaga o cookie de sessão no servidor e volta para a tela de login.
export async function logout() {
  try { await fetch("/api/auth/logout", { method: "POST" }); } catch {}
  window.location.href = "/login";
}
