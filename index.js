// index.js — Roblox Portfolio API ready for Google Cloud Run
const express = require("express");
const fetch = require("node-fetch");
const app = express();

// Fetch user-created games
async function getCreatedGames(userId) {
  const res = await fetch(
    `https://games.roblox.com/v2/users/${userId}/games?accessFilter=Public&limit=50`
  );
  const data = await res.json();
  return data.data || [];
}

// Fetch user groups
async function getUserGroups(userId) {
  const res = await fetch(
    `https://groups.roblox.com/v2/users/${userId}/groups/roles`
  );
  const data = await res.json();
  return data.data || [];
}

// Fetch group games
async function getGroupGames(groupId) {
  const res = await fetch(
    `https://games.roblox.com/v2/groups/${groupId}/games?accessFilter=Public&limit=50`
  );
  const data = await res.json();
  return data.data || [];
}

// Fetch game details
async function getGameDetails(universeIds) {
  if (!universeIds.length) return [];
  const res = await fetch(
    `https://games.roblox.com/v1/games?universeIds=${universeIds.join(",")}`
  );
  const data = await res.json();
  return data.data || [];
}

// Fetch game thumbnails
async function getThumbnails(universeIds) {
  if (!universeIds.length) return [];
  const res = await fetch(
    `https://thumbnails.roblox.com/v1/games/icons?universeIds=${universeIds.join(",")}&size=512x512&format=Png&isCircular=false`
  );
  const data = await res.json();
  return data.data || [];
}

// Portfolio route
app.get("/portfolio/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;

    const createdGames = await getCreatedGames(userId);
    const groups = await getUserGroups(userId);

    let groupGames = [];
    for (const group of groups) {
      const games = await getGroupGames(group.group.id);
      groupGames = groupGames.concat(games);
    }

    const allGames = [...createdGames, ...groupGames];
    const universeIds = allGames.map(g => g.id);

    const details = await getGameDetails(universeIds);
    const thumbnails = await getThumbnails(universeIds);

    const finalGames = details.map(game => {
      const thumb = thumbnails.find(t => t.targetId === game.id);
      return {
        id: game.id,
        name: game.name,
        creator: game.creator.name,
        playing: game.playing,
        visits: game.visits,
        description: game.description || "No description provided.",
        icon: thumb ? thumb.imageUrl : null
      };
    });

    res.json({ games: finalGames });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch data" });
  }
});

// Test route
app.get("/", (req, res) => {
  res.send("Server is alive! Use /portfolio/:userId");
});

// Listen on the port provided by Cloud Run
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
