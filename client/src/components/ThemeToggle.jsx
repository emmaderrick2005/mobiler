import { useTheme } from "../context/ThemeContext";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button type="button" className="theme-toggle" onClick={toggleTheme}>
      {theme === "dark" ? "☀️ Light mode" : "🌙 Dark mode"}
    </button>
  );
}
