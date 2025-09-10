import { createSignal } from "solid-js";

export default function App() {
  const [count, setCount] = createSignal(0);
  const increment = async () => {
    try {
      const res = await fetch('/api/hello');
      const data = await res.json();
      console.log(data);
    } catch (e) {
      console.error(e);
    }
    setCount(c => c + 1);
  };

  return (
    <main style={{ padding: '2rem', 'font-family': 'system-ui, sans-serif' }}>
      <h1>Solid + Vite + Hono (Workers)</h1>
      <p>Click to call the Hono API running on a Worker.</p>
      <button onClick={increment}>Clicked {count()} times</button>
    </main>
  );
}
