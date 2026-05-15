try {
  var t = localStorage.getItem("pp-theme");
  if (
    t === "dark" ||
    (t !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches)
  ) {
    document.documentElement.classList.add("dark");
  }
} catch (e) {}
