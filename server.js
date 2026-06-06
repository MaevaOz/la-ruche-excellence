import express from "express";
import session from "express-session";
import fs from "fs/promises";
import path from "path";

const app = express();
// Remplacer : const PORT = 3000;
// Par ce bloc adaptatif :
const PORT = process.env.PORT || 3000;
const CONTENT_FILE = path.join(process.cwd(), "content.json");
const viewsPath = path.join(process.cwd(), "views");

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "super-secret-key-pour-la-ruche",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === "production", maxAge: 1000 * 60 * 60 * 24 },
  })
);

app.use("/assets", express.static(path.join(process.cwd(), "assets")));
app.use(express.static(path.join(process.cwd(), "public")));

// Public Routes
app.get("/", (req, res) => res.sendFile(path.join(viewsPath, "index.html")));
app.get("/about", (req, res) => res.sendFile(path.join(viewsPath, "about.html")));
app.get("/products", (req, res) => res.sendFile(path.join(viewsPath, "products.html")));
app.get("/products/:id", (req, res) => res.sendFile(path.join(viewsPath, "product-detail.html")));
app.get("/services", (req, res) => res.sendFile(path.join(viewsPath, "services.html")));
app.get("/contact", (req, res) => res.sendFile(path.join(viewsPath, "contact.html")));
app.get("/blog", (req, res) => res.sendFile(path.join(viewsPath, "blog.html")));
app.get("/legal", (req, res) => res.sendFile(path.join(viewsPath, "legal.html")));

const requireAuth = (req, res, next) => {
  if (req.session && req.session.isAuthenticated) {
    return next();
  }
  if (req.method === "GET") {
    res.redirect("/admin/login");
  } else {
    res.status(401).json({ error: "Unauthorized" });
  }
};

app.get("/api/content", async (req, res) => {
  try {
    const data = await fs.readFile(CONTENT_FILE, "utf-8");
    res.json(JSON.parse(data));
  } catch (error) {
    res.status(500).json({ error: "Failed to read content" });
  }
});

app.get("/admin/login", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="fr">
      <head>
        <title>Connexion Administration - La Ruche Excellence</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&display=swap" rel="stylesheet">
        <style>body { font-family: 'Inter', sans-serif; background-color: #f8f6f0; } h1, h2, h3 { font-family: 'Playfair Display', serif; }</style>
      </head>
      <body class="flex items-center justify-center min-h-screen">
        <form method="POST" action="/admin/login" class="bg-white p-10 rounded-sm shadow-2xl w-full max-w-sm border-t-[6px] border-[#C5A880]">
          <div class="text-center mb-8">
            <h1 class="text-3xl font-bold text-[#0B132B]">La Ruche<span class="text-[#C5A880]">.</span></h1>
            <p class="text-xs uppercase tracking-[0.2em] text-gray-500 font-semibold mt-2">Accès Sécurisé</p>
          </div>
          <div id="error-container" class="mb-4 hidden text-red-600 text-sm font-bold text-center uppercase tracking-widest"></div>
          <div class="mb-6">
            <label class="block text-xs font-bold text-[#0B132B] mb-2 uppercase tracking-wide">Mot de passe</label>
            <input type="password" name="password" placeholder="••••••••" class="w-full p-3 border border-gray-300 rounded-none focus:outline-none focus:border-[#C5A880] focus:ring-1 focus:ring-[#C5A880] transition-colors bg-gray-50" required />
          </div>
          <button type="submit" class="w-full bg-[#0B132B] text-white py-3 font-bold uppercase tracking-widest text-sm transition-colors mt-2">Authentification</button>
        </form>
        <script>
          const urlParams = new URLSearchParams(window.location.search);
          if (urlParams.get('error') === '1') {
            const err = document.getElementById('error-container');
            err.innerText = 'Mot de passe incorrect.';
            err.classList.remove('hidden');
          }
        </script>
      </body>
    </html>
  `);
});

app.post("/admin/login", (req, res) => {
  const { password } = req.body;
  if (password === (process.env.ADMIN_PASSWORD || "excellence2026")) {
    req.session.isAuthenticated = true;
    res.redirect("/admin");
  } else {
    res.redirect("/admin/login?error=1");
  }
});

app.post("/admin/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/admin/login"));
});

app.use("/admin", requireAuth);
app.get("/admin", async (req, res) => res.sendFile(path.join(viewsPath, "admin.html")));

// Route de Sauvegarde CMS Evolutive (Gère l'ajout, l'édition et la suppression complète)
app.post("/admin", requireAuth, async (req, res) => {
  try {
    const rawData = await fs.readFile(CONTENT_FILE, "utf-8");
    const content = JSON.parse(rawData);

    // Étape 1 : Identifier et vider les tableaux modifiés pour éviter les éléments fantômes restants
    const arraysToReset = new Set();
    for (const key of Object.keys(req.body)) {
      const match = key.match(/^([^\[]+)\[\d+\]/);
      if (match) {
        arraysToReset.add(match[1]);
      }
    }

    for (const arrayPath of arraysToReset) {
      const parts = arrayPath.split('.');
      let current = content;
      for (let i = 0; i < parts.length - 1; i++) {
        if (current[parts[i]]) current = current[parts[i]];
      }
      if (current && parts[parts.length - 1] in current) {
        current[parts[parts.length - 1]] = [];
      }
    }

    // Étape 2 : Reconstruire l'objet structuré à partir des données transmises
    for (const [key, value] of Object.entries(req.body)) {
      const parts = key.replace(/\[(\d+)\]/g, '.$1').split('.');
      let current = content;
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!current[part]) {
          current[part] = /^\d+$/.test(parts[i + 1]) ? [] : {};
        }
        current = current[part];
      }
      current[parts[parts.length - 1]] = value;
    }

    await fs.writeFile(CONTENT_FILE, JSON.stringify(content, null, 2), "utf-8");
    res.redirect("/admin?success=1");
  } catch (error) {
    console.error(error);
    res.redirect("/admin?error=invalid_data");
  }
});

app.listen(PORT, () => {
    console.log(`Serveur en ligne sur le port ${PORT}`);
});