// index.js
import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());

// Root route for health check
app.get("/", (req, res) => {
  res.send(`✅ Roblox API is alive! Listening on PORT ${PORT}`);
});

// Example API: fetch Roblox user games
app.get("/portfolio/:username", async (req, res) => {
  const username = req.params.username;

  try {
    // Step 1: Get Roblox userId from username
    const userRes = await fetch(
      `https://api.roblox.com/users/get-by-username?username=${username}`
    );
    const userData = await userRes.json();

    if (!userData.Id) {
      return res.status(404).json({ error: "User not found" });
    }

    const userId = userData.Id;

    // Step 2: Get Roblox user games (example: favorites or creations)
    const gamesRes = await fetch(
      `https://games.roblox.com/v1/users/${userId}/games?sortOrder=Asc&limit=10`
    );
    const gamesData = await gamesRes.json();

    return res.json({
      username: username,
      userId: userId,
      games: gamesData.data || [],
    });
  } catch (err) {
    console.error("Error fetching Roblox data:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Start server immediately
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
