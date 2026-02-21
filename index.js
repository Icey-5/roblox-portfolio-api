import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());

// Health check route (Cloud Run uses this)
app.get("/", (req, res) => {
  res.send(`✅ Roblox API is alive!`);
});

// Example API endpoint
app.get("/portfolio/:username", async (req, res) => {
  const username = req.params.username;

  try {
    // Get Roblox userId
    const userRes = await fetch(
      `https://api.roblox.com/users/get-by-username?username=${username}`
    );
    const userData = await userRes.json();

    if (!userData.Id) return res.status(404).json({ error: "User not found" });

    const userId = userData.Id;

    // Get Roblox user's games (top 10 as example)
    const gamesRes = await fetch(
      `https://games.roblox.com/v1/users/${userId}/games?limit=10`
    );
    const gamesData = await gamesRes.json();

    res.json({
      username,
      userId,
      games: gamesData.data || [],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Must listen immediately
app.listen(PORT, () => {
  console.log(`✅ Server started on PORT ${PORT}`);
});
