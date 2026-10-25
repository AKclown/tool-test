import { useState, useEffect } from 'react';

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  createdAt: Date;
}

function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  // Load todos from localStorage on mount
  useEffect(() => {
    const savedTodos = localStorage.getItem('todos');
    if (savedTodos) {
      try {
        const parsed = JSON.parse(savedTodos);
        // Convert createdAt strings back to Date objects
        const todosWithDates = parsed.map((todo: any) => ({
          ...todo,
          createdAt: new Date(todo.createdAt),
        }));
        setTodos(todosWithDates);
      } catch (e) {
        console.error('Failed to parse todos from localStorage', e);
      }
    }
  }, []);

  // Save todos to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('todos', JSON.stringify(todos));
  }, [todos]);

  const addTodo = () => {
    if (newTodo.trim() === '') return;
    const newTodoItem: Todo = {
      id: Date.now().toString(),
      text: newTodo.trim(),
      completed: false,
      createdAt: new Date(),
    };
    setTodos([newTodoItem, ...todos]);
    setNewTodo('');
  };

  const deleteTodo = (id: string) => {
    setTodos(todos.filter(todo => todo.id !== id));
  };

  const toggleTodo = (id: string) => {
    setTodos(
      todos.map(todo =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    );
  };

  const startEditing = (todo: Todo) => {
    setEditingId(todo.id);
    setEditText(todo.text);
  };

  const saveEdit = () => {
    if (editText.trim() === '') return;
    setTodos(
      todos.map(todo =>
        todo.id === editingId ? { ...todo, text: editText.trim() } : todo
      )
    );
    setEditingId(null);
    setEditText('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };

  const filteredTodos = todos.filter(todo => {
    if (filter === 'active') return !todo.completed;
    if (filter === 'completed') return todo.completed;
    return true;
  });

  const activeCount = todos.filter(todo => !todo.completed).length;
  const completedCount = todos.length - activeCount;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (editingId) {
        saveEdit();
      } else {
        addTodo();
      }
    }
  };

  return (
    <div className="app">
      <div className="header">
        <h1>✨ Todo List</h1>
        <p>Organize your tasks with style</p>
      </div>

      <div className="todo-container">
        {/* Add Todo Form */}
        <div className="add-form">
          <input
            type="text"
            value={newTodo}
            onChange={(e) => setNewTodo(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What needs to be done?"
            className="todo-input"
          />
          <button onClick={addTodo} className="add-btn">
            ➕ Add
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="filter-tabs">
          <button
            onClick={() => setFilter('all')}
            className={filter === 'all' ? 'active' : ''}
          >
            All ({todos.length})
          </button>
          <button
            onClick={() => setFilter('active')}
            className={filter === 'active' ? 'active' : ''}
          >
            Active ({activeCount})
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={filter === 'completed' ? 'active' : ''}
          >
            Completed ({completedCount})
          </button>
        </div>

        {/* Todo List */}
        <ul className="todo-list">
          {filteredTodos.length === 0 ? (
            <li className="empty-state">
              {filter === 'all' && 'No todos yet! Add one above.'}
              {filter === 'active' && 'All tasks are complete! 🎉'}
              {filter === 'completed' && 'No completed tasks yet.'}
            </li>
          ) : (
            filteredTodos.map((todo) => (
              <li
                key={todo.id}
                className={`todo-item ${todo.completed ? 'completed' : ''} transition-all duration-300`}
              >
                {editingId === todo.id ? (
                  <div className="edit-form">
                    <input
                      type="text"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit();
                        if (e.key === 'Escape') cancelEdit();
                      }}
                      autoFocus
                      className="edit-input"
                    />
                    <div className="edit-actions">
                      <button onClick={saveEdit} className="save-btn">
                        ✅ Save
                      </button>
                      <button onClick={cancelEdit} className="cancel-btn">
                        ❌ Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="todo-content">
                    <input
                      type="checkbox"
                      checked={todo.completed}
                      onChange={() => toggleTodo(todo.id)}
                      className="todo-checkbox"
                    />
                    <span
                      className={`todo-text ${todo.completed ? 'line-through' : ''}`}
                    >
                      {todo.text}
                    </span>
                    <div className="todo-actions">
                      <button
                        onClick={() => startEditing(todo)}
                        className="edit-btn"
                        aria-label="Edit todo"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => deleteTodo(todo.id)}
                        className="delete-btn"
                        aria-label="Delete todo"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))
          )}
        </ul>

        {/* Stats */}
        <div className="stats">
          <span>{activeCount} {activeCount === 1 ? 'task' : 'tasks'} left</span>
          <span>{completedCount} completed</span>
        </div>
      </div>

      <style jsx>{`
        .app {
          min-height: 100vh;
          background: linear-gradient(135deg, #4b6584, #6a11cb);
          color: #fff;
          padding: 2rem;
          font-family: 'Segoe UI', system-ui, sans-serif;
        }

        .header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .header h1 {
          font-size: 2.5rem;
          margin-bottom: 0.5rem;
          text-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }

        .header p {
          font-size: 1.1rem;
          opacity: 0.9;
        }

        .todo-container {
          max-width: 600px;
          margin: 0 auto;
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          border-radius: 16px;
          padding: 1.5rem;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .add-form {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
        }

        .todo-input {
          flex: 1;
          padding: 0.75rem 1rem;
          border: none;
          border-radius: 8px;
          font-size: 1rem;
          background: rgba(255, 255, 255, 0.15);
          color: white;
          outline: none;
          transition: all 0.3s ease;
        }

        .todo-input:focus {
          background: rgba(255, 255, 255, 0.25);
          box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.3);
        }

        .todo-input::placeholder {
          color: rgba(255, 255, 255, 0.6);
        }

        .add-btn {
          padding: 0.75rem 1.5rem;
          background: #ff6b6b;
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .add-btn:hover {
          background: #ff5252;
          transform: translateY(-2px);
        }

        .filter-tabs {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
        }

        .filter-tabs button {
          padding: 0.5rem 1rem;
          background: rgba(255, 255, 255, 0.1);
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .filter-tabs button.active {
          background: rgba(255, 255, 255, 0.25);
          font-weight: bold;
        }

        .filter-tabs button:hover:not(.active) {
          background: rgba(255, 255, 255, 0.15);
        }

        .todo-list {
          list-style: none;
          padding: 0;
        }

        .todo-item {
          background: rgba(255, 255, 255, 0.1);
          margin-bottom: 0.75rem;
          padding: 1rem;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 1rem;
          transition: all 0.3s ease;
          animation: fadeIn 0.3s ease-out;
        }

        .todo-item:hover:not(.completed) {
          background: rgba(255, 255, 255, 0.15);
          transform: translateX(4px);
        }

        .todo-item.completed {
          opacity: 0.7;
        }

        .todo-content {
          display: flex;
          align-items: center;
          gap: 1rem;
          flex: 1;
        }

        .todo-checkbox {
          width: 1.5rem;
          height: 1.5rem;
          cursor: pointer;
        }

        .todo-text {
          flex: 1;
          font-size: 1.1rem;
        }

        .todo-actions {
          display: flex;
          gap: 0.5rem;
        }

        .edit-btn,
        .delete-btn {
          background: none;
          border: none;
          color: white;
          cursor: pointer;
          font-size: 1.1rem;
          width: 2.5rem;
          height: 2.5rem;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .edit-btn:hover,
        .delete-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          transform: scale(1.1);
        }

        .edit-btn:active,
        .delete-btn:active {
          transform: scale(0.95);
        }

        .edit-form {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          width: 100%;
        }

        .edit-input {
          padding: 0.5rem 1rem;
          border: none;
          border-radius: 6px;
          font-size: 1rem;
          background: rgba(255, 255, 255, 0.15);
          color: white;
          outline: none;
        }

        .edit-actions {
          display: flex;
          gap: 0.5rem;
        }

        .save-btn,
        .cancel-btn {
          padding: 0.25rem 0.75rem;
          border: none;
          border-radius: 4px;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .save-btn {
          background: #4caf50;
          color: white;
        }

        .cancel-btn {
          background: #f44336;
          color: white;
        }

        .save-btn:hover {
          background: #45a049;
        }

        .cancel-btn:hover {
          background: #da190b;
        }

        .empty-state {
          text-align: center;
          padding: 2rem;
          color: rgba(255, 255, 255, 0.7);
          font-style: italic;
        }

        .stats {
          display: flex;
          justify-content: space-between;
          margin-top: 1.5rem;
          padding-top: 1rem;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.8);
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeOut {
          from {
            opacity: 1;
            transform: translateY(0);
          }
          to {
            opacity: 0;
            transform: translateY(-10px);
          }
        }

        .transition-all {
          transition: all 0.3s ease;
        }

        .duration-300 {
          transition-duration: 0.3s;
        }

        @media (max-width: 600px) {
          .app {
            padding: 1rem;
          }
          .todo-container {
            padding: 1rem;
          }
          .add-form {
            flex-direction: column;
          }
          .add-btn {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}

export default App;