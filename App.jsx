import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Link, Navigate, useNavigate, useParams, useLocation } from "react-router-dom";
import "./App.css";

const API = "https://route-posts.routemisr.com";

// function واحدة بنكلم بيها الباك اند
async function api(path, method = "GET", body, isForm) {
  const token = localStorage.getItem("token");
  const headers = {};
  if (token) headers.Authorization = "Bearer " + token;
  if (body && !isForm) headers["Content-Type"] = "application/json";
  const res = await fetch(API + path, {
    method,
    headers,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) {
    const m = data.message || data.error || "في حاجة غلط";
    throw new Error(typeof m === "string" ? m : JSON.stringify(m));
  }
  return data;
}

// الرد ممكن يجي متغلف بأشكال مختلفة فبندور على أول array / object
function findList(d, key) {
  if (!d) return [];
  if (Array.isArray(d)) return d;
  if (key && Array.isArray(d[key])) return d[key];
  for (const k in d) if (Array.isArray(d[k])) return d[k];
  for (const k in d) {
    if (d[k] && typeof d[k] === "object") {
      const r = findList(d[k], key);
      if (r.length) return r;
    }
  }
  return [];
}
function findObj(d, key) {
  if (!d) return {};
  return d[key] || (d.data && (d.data[key] || d.data)) || d;
}
function who(x) {
  return x.user || x.author || x.commentCreator || x.createdBy || {};
}

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = localStorage.getItem("token");
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!token) return;
    api("/notifications/unread-count")
      .then((d) => {
        const n = d.count ?? d.unreadCount ?? d.data?.count ?? d.data?.unreadCount ?? d.data;
        setUnread(typeof n === "number" ? n : 0);
      })
      .catch(() => {});
  }, [location.pathname, token]);

  function logout() {
    localStorage.clear();
    navigate("/login");
  }

  return (
    <nav className="navbar">
      <Link to="/" className="logo">Social<span>App</span></Link>
      <div className="links">
        {token ? (
          <>
            <Link to="/">Home</Link>
            <Link to="/notifications">Notifications{unread > 0 && <b className="badge">{unread}</b>}</Link>
            <Link to="/profile">Profile</Link>
            <Link to="/change-password">Password</Link>
            <button onClick={logout}>Logout</button>
          </>
        ) : (
          <>
            <Link to="/login">Login</Link>
            <Link to="/signup">Sign up</Link>
          </>
        )}
      </div>
    </nav>
  );
}

function Protected({ children }) {
  if (!localStorage.getItem("token")) return <Navigate to="/login" />;
  return children;
}

function Signup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", username: "", email: "", password: "", rePassword: "", dateOfBirth: "", gender: "male" });
  const [error, setError] = useState("");

  function change(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      await api("/users/signup", "POST", form);
      alert("تم التسجيل، سجل دخول دلوقتي");
      navigate("/login");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form className="box" onSubmit={submit}>
      <h2>Create account</h2>
      <input name="name" placeholder="Name" onChange={change} required />
      <input name="username" placeholder="Username" onChange={change} required />
      <input name="email" type="email" placeholder="Email" onChange={change} required />
      <input name="password" type="password" placeholder="Password" onChange={change} required />
      <input name="rePassword" type="password" placeholder="Confirm password" onChange={change} required />
      <input name="dateOfBirth" type="date" onChange={change} required />
      <select name="gender" onChange={change}>
        <option value="male">Male</option>
        <option value="female">Female</option>
      </select>
      {error && <p className="error">{error}</p>}
      <button className="main-btn">Sign up</button>
    </form>
  );
}

function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ login: "", password: "" });
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    // ممكن تدخل بالإيميل أو اليوزرنيم
    const body = { password: form.password };
    if (form.login.includes("@")) body.email = form.login;
    else body.username = form.login;
    try {
      const data = await api("/users/signin", "POST", body);
      const token = data.token || data.data?.token;
      if (!token) throw new Error("مفيش token راجع من السيرفر");
      localStorage.setItem("token", token);
      const profile = await api("/users/profile-data");
      const u = findObj(profile, "user");
      localStorage.setItem("userId", u._id || u.id);
      navigate("/");
    } catch (err) {
      localStorage.clear();
      setError(err.message);
    }
  }

  return (
    <form className="box" onSubmit={submit}>
      <h2>Welcome back</h2>
      <input placeholder="Email or username" onChange={(e) => setForm({ ...form, login: e.target.value })} required />
      <input type="password" placeholder="Password" onChange={(e) => setForm({ ...form, password: e.target.value })} required />
      {error && <p className="error">{error}</p>}
      <button className="main-btn">Login</button>
      <p className="small">No account? <Link to="/signup">Sign up</Link></p>
    </form>
  );
}

// فورم مشترك للانشاء والتعديل
function PostForm({ post, onDone, onCancel }) {
  const [body, setBody] = useState(post ? post.body : "");
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const fd = new FormData();
    fd.append("body", body);
    if (image) fd.append("image", image);
    setLoading(true);
    try {
      if (post) await api("/posts/" + post._id, "PUT", fd, true);
      else await api("/posts", "POST", fd, true);
      setBody("");
      setImage(null);
      e.target.reset();
      onDone();
    } catch (err) {
      alert(err.message);
    }
    setLoading(false);
  }

  return (
    <form className="card" onSubmit={submit}>
      <textarea placeholder="What's on your mind?" value={body} onChange={(e) => setBody(e.target.value)} required />
      <input type="file" accept="image/*" onChange={(e) => setImage(e.target.files[0])} />
      <div className="row">
        <button className="main-btn" disabled={loading}>{post ? "Update" : "Post"}</button>
        {post && <button type="button" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}

function PostCard({ post, reload, details }) {
  const [editing, setEditing] = useState(false);
  const author = who(post);
  const isMine = author._id === localStorage.getItem("userId");
  const likes = post.likesCount ?? post.likes?.length ?? 0;
  const commentsCount = post.commentsCount ?? post.comments?.length ?? 0;

  // لايك / حفظ / شير كلهم نفس الفكرة
  async function action(path, method, msg) {
    try {
      await api(path, method);
      if (msg) alert(msg);
      reload();
    } catch (err) {
      alert(err.message);
    }
  }

  async function remove() {
    if (!confirm("متأكد انك عايز تمسح البوست؟")) return;
    try {
      await api("/posts/" + post._id, "DELETE");
      reload(true);
    } catch (err) {
      alert(err.message);
    }
  }

  if (editing) {
    return <PostForm post={post} onCancel={() => setEditing(false)} onDone={() => { setEditing(false); reload(); }} />;
  }

  return (
    <div className="card">
      <div className="user">
        <img src={author.photo} alt="" />
        <div>
          <b>{author.name || author.username}</b>
          <small>{new Date(post.createdAt).toLocaleString()}</small>
        </div>
      </div>
      <p>{post.body}</p>
      {post.image && <img className="post-img" src={post.image} alt="" />}
      <div className="row wrap">
        <button onClick={() => action("/posts/" + post._id + "/like", "PUT")}>Like ({likes})</button>
        <button onClick={() => action("/posts/" + post._id + "/bookmark", "PUT")}>Save</button>
        <button onClick={() => action("/posts/" + post._id + "/share", "POST", "تم الشير")}>Share</button>
        {!details && <Link to={"/post/" + post._id}>Comments ({commentsCount})</Link>}
        {isMine && <button onClick={() => setEditing(true)}>Edit</button>}
        {isMine && <button className="del" onClick={remove}>Delete</button>}
      </div>
    </div>
  );
}

function Home() {
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(true);
  const [loading, setLoading] = useState(true);

  async function getPosts(p = 1) {
    try {
      const data = await api("/posts/feed?only=all&limit=10&page=" + p);
      const list = findList(data, "posts");
      setPosts(p === 1 ? list : [...posts, ...list]);
      setMore(list.length === 10);
      setPage(p);
    } catch (err) {
      alert(err.message);
    }
    setLoading(false);
  }

  useEffect(() => { getPosts(1); }, []);

  return (
    <div className="page">
      <PostForm onDone={() => getPosts(1)} />
      {loading && <p className="small">Loading...</p>}
      {posts.map((p) => <PostCard key={p._id} post={p} reload={() => getPosts(1)} />)}
      {more && !loading && <button className="main-btn" onClick={() => getPosts(page + 1)}>Load more</button>}
    </div>
  );
}

function Comment({ comment, postId, reload }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(comment.content);
  const author = who(comment);
  const isMine = author._id === localStorage.getItem("userId");
  const url = "/posts/" + postId + "/comments/" + comment._id;

  async function update() {
    try {
      await api(url, "PUT", { content: text });
      setEditing(false);
      reload();
    } catch (err) {
      alert(err.message);
    }
  }

  async function remove() {
    if (!confirm("مسح التعليق؟")) return;
    try {
      await api(url, "DELETE");
      reload();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div className="comment">
      <img src={author.photo} alt="" />
      <div className="comment-body">
        <b>{author.name || author.username}</b>
        {editing ? (
          <div className="row">
            <input value={text} onChange={(e) => setText(e.target.value)} />
            <button className="main-btn" onClick={update}>Save</button>
          </div>
        ) : (
          <p>{comment.content}</p>
        )}
        {isMine && !editing && (
          <div className="row">
            <button onClick={() => setEditing(true)}>Edit</button>
            <button className="del" onClick={remove}>Delete</button>
          </div>
        )}
      </div>
    </div>
  );
}

function PostDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");

  async function getData() {
    try {
      let p;
      try {
        p = findObj(await api("/posts/" + id), "post");
      } catch (e) {
        // لو مفيش endpoint لبوست واحد بندور عليه في الفيد
        const list = findList(await api("/posts?limit=100"), "posts");
        p = list.find((x) => x._id === id);
      }
      if (!p) throw new Error("البوست مش موجود");
      setPost(p);
      const c = await api("/posts/" + id + "/comments?page=1&limit=50");
      setComments(findList(c, "comments"));
    } catch (err) {
      alert(err.message);
    }
  }

  useEffect(() => { getData(); }, [id]);

  async function addComment(e) {
    e.preventDefault();
    const fd = new FormData();
    fd.append("content", text);
    try {
      await api("/posts/" + id + "/comments", "POST", fd, true);
      setText("");
      getData();
    } catch (err) {
      alert(err.message);
    }
  }

  function afterPost(deleted) {
    if (deleted) navigate("/");
    else getData();
  }

  if (!post) return <p className="small">Loading...</p>;

  return (
    <div className="page">
      <PostCard post={post} reload={afterPost} details />
      <form className="card row" onSubmit={addComment}>
        <input placeholder="Write a comment..." value={text} onChange={(e) => setText(e.target.value)} required />
        <button className="main-btn">Send</button>
      </form>
      {comments.map((c) => <Comment key={c._id} comment={c} postId={id} reload={getData} />)}
      {comments.length === 0 && <p className="small">No comments yet</p>}
    </div>
  );
}

function Profile() {
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);

  async function getData() {
    try {
      const u = findObj(await api("/users/profile-data"), "user");
      setUser(u);
      const data = await api("/posts/feed?only=me&limit=30");
      setPosts(findList(data, "posts"));
    } catch (err) {
      alert(err.message);
    }
  }

  useEffect(() => { getData(); }, []);

  async function changePhoto(e) {
    const fd = new FormData();
    fd.append("photo", e.target.files[0]);
    try {
      await api("/users/upload-photo", "PUT", fd, true);
      getData();
    } catch (err) {
      alert(err.message);
    }
  }

  if (!user) return <p className="small">Loading...</p>;

  return (
    <div className="page">
      <div className="card profile">
        <img src={user.photo} alt="" />
        <h2>{user.name}</h2>
        <p className="small">@{user.username} - {user.email}</p>
        <p className="small">{user.gender} - {user.dateOfBirth}</p>
        <input type="file" accept="image/*" onChange={changePhoto} />
      </div>
      <h3>My posts</h3>
      {posts.map((p) => <PostCard key={p._id} post={p} reload={getData} />)}
      {posts.length === 0 && <p className="small">No posts yet</p>}
    </div>
  );
}

function Notifications() {
  const [list, setList] = useState([]);

  async function getData() {
    try {
      setList(findList(await api("/notifications?page=1&limit=30"), "notifications"));
    } catch (err) {
      alert(err.message);
    }
  }

  useEffect(() => { getData(); }, []);

  async function readOne(id) {
    try { await api("/notifications/" + id + "/read", "PATCH"); getData(); } catch (err) { alert(err.message); }
  }
  async function readAll() {
    try { await api("/notifications/read-all", "PATCH"); getData(); } catch (err) { alert(err.message); }
  }

  return (
    <div className="page">
      <div className="row"><h3>Notifications</h3><button onClick={readAll}>Mark all as read</button></div>
      {list.map((n) => {
        const isRead = n.isRead ?? n.read;
        return (
          <div key={n._id} className={"card " + (isRead ? "" : "unread")}>
            <p>
              <b>{(n.actor || n.sender || n.from || {}).name} </b>
              {n.message || n.text || n.type}
            </p>
            <small className="small">{new Date(n.createdAt).toLocaleString()}</small>
            {!isRead && <button onClick={() => readOne(n._id)}>Mark as read</button>}
          </div>
        );
      })}
      {list.length === 0 && <p className="small">No notifications</p>}
    </div>
  );
}

function ChangePassword() {
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setMsg("");
    setError("");
    try {
      const data = await api("/users/change-password", "PATCH", { password, newPassword });
      const t = data.token || data.data?.token;
      if (t) localStorage.setItem("token", t);
      setMsg("Password changed");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form className="box" onSubmit={submit}>
      <h2>Change password</h2>
      <input type="password" placeholder="Current password" onChange={(e) => setPassword(e.target.value)} required />
      <input type="password" placeholder="New password" onChange={(e) => setNewPassword(e.target.value)} required />
      {error && <p className="error">{error}</p>}
      {msg && <p className="ok">{msg}</p>}
      <button className="main-btn">Change</button>
    </form>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Protected><Home /></Protected>} />
        <Route path="/post/:id" element={<Protected><PostDetails /></Protected>} />
        <Route path="/profile" element={<Protected><Profile /></Protected>} />
        <Route path="/notifications" element={<Protected><Notifications /></Protected>} />
        <Route path="/change-password" element={<Protected><ChangePassword /></Protected>} />
      </Routes>
    </BrowserRouter>
  );
}
