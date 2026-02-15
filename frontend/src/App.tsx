import { useEffect, useMemo, useState } from 'react'
import { Link, Route, Routes, useNavigate } from 'react-router-dom'

const API = 'http://localhost:8000'
const AUTH_API = 'http://localhost:8001/api'

type Priority = 'high' | 'medium' | 'low'

type Todo = {
  id: number
  title: string
  description: string
  priority: Priority
  assignee: string
  creator: string
  due_date: string | null
  is_overdue: boolean
  created_at: string
  updated_at: string
}

type AuthState = {
  token: string | null
  user: string | null
  setToken: (token: string | null) => void
  setUser: (user: string | null) => void
  logout: () => void
}

function useAuth(): AuthState {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
  const [user, setUser] = useState<string | null>(localStorage.getItem('user'))

  const logout = (): void => {
    localStorage.clear()
    setToken(null)
    setUser(null)
  }

  return { token, user, setToken, setUser, logout }
}

function Dashboard({ token }: { token: string | null }) {
  const [todos, setTodos] = useState<Todo[]>([])
  const [selected, setSelected] = useState<Todo | null>(null)

  useEffect(() => {
    const refreshTodos = (): void => {
      void fetch(`${API}/todos`)
        .then((res) => res.json())
        .then((data: Todo[]) => setTodos(data))
    }

    refreshTodos()

    const ws = new WebSocket('ws://localhost:8000/ws/todos')
    ws.onmessage = () => {
      refreshTodos()
    }

    return () => ws.close()
  }, [])

  const columns = useMemo<Record<Priority, Todo[]>>(
    () => ({ high: [], medium: [], low: [] }),
    [todos],
  )

  todos.forEach((todo) => {
    columns[todo.priority].push(todo)
  })

  return (
    <div>
      <div className="header">
        <h1>ToDo Dashboard</h1>
        <Link to={token ? '/edit' : '/login'} className="button">
          {token ? '編集画面へ' : 'ログイン'}
        </Link>
      </div>
      <div className="grid">
        {(Object.entries(columns) as Array<[Priority, Todo[]]>).map(([priority, cards]) => (
          <section key={priority}>
            <h2>{priority.toUpperCase()}</h2>
            {cards.map((todo) => (
              <article key={todo.id} className="card" onClick={() => setSelected(todo)}>
                <h3>{todo.title}</h3>
                <p>期限: {todo.due_date ? new Date(todo.due_date).toLocaleDateString() : '未設定'}</p>
                <p>期限超過: {todo.is_overdue ? 'はい' : 'いいえ'}</p>
                <p>担当: {todo.assignee || '-'}</p>
              </article>
            ))}
          </section>
        ))}
      </div>
      {selected && <TodoModal todo={selected} canEdit={Boolean(token)} onClose={() => setSelected(null)} />}
    </div>
  )
}

function TodoModal({ todo, canEdit, onClose }: { todo: Todo; canEdit: boolean; onClose: () => void }) {
  const navigate = useNavigate()

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-content" onClick={(event) => event.stopPropagation()}>
        <h3>{todo.title}</h3>
        <p>{todo.description}</p>
        <p>記入者: {todo.creator}</p>
        <p>最終更新: {new Date(todo.updated_at).toLocaleString()}</p>
        {canEdit && (
          <button className="button" onClick={() => navigate('/edit')}>
            編集画面へ
          </button>
        )}
      </div>
    </div>
  )
}

function Login({ auth }: { auth: AuthState }) {
  const nav = useNavigate()
  const [form, setForm] = useState({ username: '', password: '', provider: 'google' })

  const submit = async (path: 'login' | 'register'): Promise<void> => {
    const res = await fetch(`${AUTH_API}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    if (!res.ok) {
      nav('/register')
      return
    }

    const data: { access_token: string; username: string } = await res.json()
    localStorage.setItem('token', data.access_token)
    localStorage.setItem('user', data.username)
    auth.setToken(data.access_token)
    auth.setUser(data.username)
    nav('/edit')
  }

  return (
    <div className="panel">
      <h2>SSO ログイン</h2>
      <select onChange={(event) => setForm({ ...form, provider: event.target.value })}>
        <option value="google">Google</option>
        <option value="microsoft">Microsoft</option>
      </select>
      <input placeholder="username" onChange={(event) => setForm({ ...form, username: event.target.value })} />
      <input
        type="password"
        placeholder="password"
        onChange={(event) => setForm({ ...form, password: event.target.value })}
      />
      <button className="button" onClick={() => void submit('login')}>
        ログイン
      </button>
      <button className="button secondary" onClick={() => nav('/register')}>
        ユーザ登録へ
      </button>
    </div>
  )
}

function Register({ auth }: { auth: AuthState }) {
  const nav = useNavigate()
  const [form, setForm] = useState({ username: '', password: '', email: '', provider: 'google' })

  const submit = async (): Promise<void> => {
    const res = await fetch(`${AUTH_API}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    const data: { access_token: string; username: string } = await res.json()
    localStorage.setItem('token', data.access_token)
    localStorage.setItem('user', data.username)
    auth.setToken(data.access_token)
    auth.setUser(data.username)
    nav('/edit')
  }

  return (
    <div className="panel">
      <h2>ユーザ登録 (SSO連携)</h2>
      <input placeholder="email" onChange={(event) => setForm({ ...form, email: event.target.value })} />
      <input placeholder="username" onChange={(event) => setForm({ ...form, username: event.target.value })} />
      <input
        type="password"
        placeholder="password"
        onChange={(event) => setForm({ ...form, password: event.target.value })}
      />
      <button className="button" onClick={() => void submit()}>
        登録
      </button>
    </div>
  )
}

type TodoCreateForm = {
  title: string
  description: string
  priority: Priority
  due_date: string
  assignee: string
  creator: string
}

function Editor({ token, user }: { token: string | null; user: string | null }) {
  const [todos, setTodos] = useState<Todo[]>([])
  const [form, setForm] = useState<TodoCreateForm>({
    title: '',
    description: '',
    priority: 'medium',
    due_date: '',
    assignee: '',
    creator: user ?? '',
  })

  const fetchTodos = (): void => {
    void fetch(`${API}/todos`)
      .then((res) => res.json())
      .then((data: Todo[]) => setTodos(data))
  }

  useEffect(() => {
    fetchTodos()
  }, [])

  const save = async (): Promise<void> => {
    if (!token) {
      return
    }

    await fetch(`${API}/todos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        ...form,
        due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
      }),
    })

    setForm({ title: '', description: '', priority: 'medium', due_date: '', assignee: '', creator: user ?? '' })
    fetchTodos()
  }

  const removeTodo = async (id: number): Promise<void> => {
    if (!token) {
      return
    }

    await fetch(`${API}/todos/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    fetchTodos()
  }

  return (
    <div className="panel">
      <h2>ToDoタスク編集画面</h2>
      <input
        placeholder="タスクタイトル"
        value={form.title}
        onChange={(event) => setForm({ ...form, title: event.target.value })}
      />
      <textarea
        placeholder="タスク内容"
        value={form.description}
        onChange={(event) => setForm({ ...form, description: event.target.value })}
      />
      <input type="date" onChange={(event) => setForm({ ...form, due_date: event.target.value })} />
      <input placeholder="担当者" value={form.assignee} onChange={(event) => setForm({ ...form, assignee: event.target.value })} />
      <select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as Priority })}>
        <option value="high">high</option>
        <option value="medium">medium</option>
        <option value="low">low</option>
      </select>
      <button className="button" onClick={() => void save()}>
        保存
      </button>
      <ul>
        {todos.map((todo) => (
          <li key={todo.id}>
            {todo.title} <button onClick={() => void removeTodo(todo.id)}>削除</button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function App() {
  const auth = useAuth()

  return (
    <Routes>
      <Route path="/" element={<Dashboard token={auth.token} />} />
      <Route path="/login" element={<Login auth={auth} />} />
      <Route path="/register" element={<Register auth={auth} />} />
      <Route path="/edit" element={<Editor token={auth.token} user={auth.user} />} />
      <Route
        path="*"
        element={
          <div className="panel">
            <p>ページが見つかりません。</p>
            <Link to="/" className="button">
              ダッシュボードへ戻る
            </Link>
          </div>
        }
      />
    </Routes>
  )
}
