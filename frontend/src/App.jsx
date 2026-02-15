import { useEffect, useMemo, useState } from 'react'
import { Routes, Route, Link, useNavigate } from 'react-router-dom'

const API = 'http://localhost:8000'
const AUTH_API = 'http://localhost:8001/api'

function useAuth() {
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [user, setUser] = useState(localStorage.getItem('user'))
  const logout = () => {
    localStorage.clear()
    setToken(null)
    setUser(null)
  }
  return { token, user, setToken, setUser, logout }
}

function Dashboard({ token }) {
  const [todos, setTodos] = useState([])
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    fetch(`${API}/todos`).then((res) => res.json()).then(setTodos)
    const ws = new WebSocket('ws://localhost:8000/ws/todos')
    ws.onmessage = () => fetch(`${API}/todos`).then((res) => res.json()).then(setTodos)
    return () => ws.close()
  }, [])

  const columns = useMemo(() => ({ high: [], medium: [], low: [] }), [])
  todos.forEach((todo) => {
    ;(columns[todo.priority] ?? columns.medium).push(todo)
  })

  return (
    <div>
      <div className="header">
        <h1>ToDo Dashboard</h1>
        <Link to={token ? '/edit' : '/login'} className="button">{token ? '編集画面へ' : 'ログイン'}</Link>
      </div>
      <div className="grid">
        {Object.entries(columns).map(([priority, cards]) => (
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

function TodoModal({ todo, canEdit, onClose }) {
  const navigate = useNavigate()
  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>{todo.title}</h3>
        <p>{todo.description}</p>
        <p>記入者: {todo.creator}</p>
        <p>最終更新: {new Date(todo.updated_at).toLocaleString()}</p>
        {canEdit && <button className="button" onClick={() => navigate('/edit')}>編集画面へ</button>}
      </div>
    </div>
  )
}

function Login({ auth }) {
  const nav = useNavigate()
  const [form, setForm] = useState({ username: '', password: '', provider: 'google' })
  const submit = async (path) => {
    const res = await fetch(`${AUTH_API}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    if (!res.ok) {
      nav('/register')
      return
    }
    const data = await res.json()
    localStorage.setItem('token', data.access_token)
    localStorage.setItem('user', data.username)
    auth.setToken(data.access_token)
    auth.setUser(data.username)
    nav('/edit')
  }
  return (
    <div className="panel">
      <h2>SSO ログイン</h2>
      <select onChange={(e) => setForm({ ...form, provider: e.target.value })}>
        <option value="google">Google</option>
        <option value="microsoft">Microsoft</option>
      </select>
      <input placeholder="username" onChange={(e) => setForm({ ...form, username: e.target.value })} />
      <input type="password" placeholder="password" onChange={(e) => setForm({ ...form, password: e.target.value })} />
      <button className="button" onClick={() => submit('login')}>ログイン</button>
      <button className="button secondary" onClick={() => nav('/register')}>ユーザ登録へ</button>
    </div>
  )
}

function Register({ auth }) {
  const nav = useNavigate()
  const [form, setForm] = useState({ username: '', password: '', email: '', provider: 'google' })
  const submit = async () => {
    const res = await fetch(`${AUTH_API}/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const data = await res.json()
    localStorage.setItem('token', data.access_token)
    localStorage.setItem('user', data.username)
    auth.setToken(data.access_token)
    auth.setUser(data.username)
    nav('/edit')
  }
  return (
    <div className="panel">
      <h2>ユーザ登録 (SSO連携)</h2>
      <input placeholder="email" onChange={(e) => setForm({ ...form, email: e.target.value })} />
      <input placeholder="username" onChange={(e) => setForm({ ...form, username: e.target.value })} />
      <input type="password" placeholder="password" onChange={(e) => setForm({ ...form, password: e.target.value })} />
      <button className="button" onClick={submit}>登録</button>
    </div>
  )
}

function Editor({ token, user }) {
  const [todos, setTodos] = useState([])
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium', due_date: '', assignee: '', creator: user ?? '' })

  const fetchTodos = () => fetch(`${API}/todos`).then((r) => r.json()).then(setTodos)
  useEffect(() => { fetchTodos() }, [])

  const save = async () => {
    await fetch(`${API}/todos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...form, due_date: form.due_date ? new Date(form.due_date).toISOString() : null }),
    })
    setForm({ title: '', description: '', priority: 'medium', due_date: '', assignee: '', creator: user ?? '' })
    fetchTodos()
  }

  const removeTodo = async (id) => {
    await fetch(`${API}/todos/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    fetchTodos()
  }

  return (
    <div className="panel">
      <h2>ToDoタスク編集画面</h2>
      <input placeholder="タスクタイトル" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      <textarea placeholder="タスク内容" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      <input type="date" onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
      <input placeholder="担当者" value={form.assignee} onChange={(e) => setForm({ ...form, assignee: e.target.value })} />
      <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
        <option value="high">high</option>
        <option value="medium">medium</option>
        <option value="low">low</option>
      </select>
      <button className="button" onClick={save}>保存</button>
      <ul>
        {todos.map((todo) => (
          <li key={todo.id}>{todo.title} <button onClick={() => removeTodo(todo.id)}>削除</button></li>
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
    </Routes>
  )
}
