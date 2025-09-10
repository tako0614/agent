import { createSignal, onMount } from 'solid-js';

function App() {
  const [message, setMessage] = createSignal<string>('');
  const [loading, setLoading] = createSignal<boolean>(false);

  const fetchMessage = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/hello');
      const data = await response.json() as { msg: string };
      setMessage(data.msg);
    } catch (error) {
      console.error('Error:', error);
      setMessage('Error loading message');
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    fetchMessage();
  });

  return (
    <div class="container">
      <h1>Hello World App</h1>
      <p>Vite + SolidJS + Workers + Hono</p>
      
      <div class="card">
        {loading() ? (
          <p>Loading...</p>
        ) : (
          <p>{message()}</p>
        )}
        <button onClick={fetchMessage} disabled={loading()}>
          Refresh
        </button>
      </div>
    </div>
  );
}

export default App;
