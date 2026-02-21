const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Roblox API key (needed for some endpoints)
const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY;

// Get userId from username
async function getUserId(username) {
  const res = await axios.post("https://users.roblox.com/v1/usernames/users", {
    usernames: [username],
    excludeBannedUsers: false
  });
  const user = res.data.data[0];
  if (user && user.id) return user.id;
  throw new Error("User not found");
}

// Get universeId from placeId using Open Cloud API
async function getUniverseIdFromPlaceId(placeId) {
  try {
    const res = await axios.get(
      `https://apis.roblox.com/universes/v1/places/${placeId}/universe`,
      {
        headers: { "x-api-key": ROBLOX_API_KEY }
      }
    );
    return res.data.universeId;
  } catch (err) {
    console.warn(`Failed to get universeId for place ${placeId}: ${err.message}`);
    return null;
  }
}

// Fetch user games (paged)
async function fetchGames(ownerType, ownerId) {
  let games = [];
  let cursor = "";
  let hasMore = true;

  while (hasMore) {
    try {
      const url = `https://games.roblox.com/v2/${ownerType}/${ownerId}/games?sortOrder=Asc&limit=50${cursor ? `&cursor=${cursor}` : ""}`;
      const res = await axios.get(url);
      if (res.data.data && res.data.data.length) games.push(...res.data.data);
      cursor = res.data.nextPageCursor;
      if (!cursor) hasMore = false;
    } catch (err) {
      console.error(`Failed to fetch games for ${ownerType} ${ownerId}: ${err.message}`);
      hasMore = false;
    }
  }

  return games;
}

// Fetch groups where user is owner
async function fetchOwnedGroups(userId) {
  try {
    const url = `https://groups.roblox.com/v1/users/${userId}/groups/roles`;
    const res = await axios.get(url);
    return (res.data.data || [])
      .filter(g => g.role.rank === 255)
      .map(g => g.group.id);
  } catch (err) {
    console.error(`Failed to fetch groups for user ${userId}: ${err.message}`);
    return [];
  }
}

// Fetch game details by universeId
async function fetchGameDetails(universeIds) {
  if (!universeIds.length) return [];
  const url = `https://games.roblox.com/v1/games?universeIds=${universeIds.join(",")}`;
  const res = await axios.get(url);
  return res.data.data || [];
}

// Fetch game thumbnails
async function fetchThumbnails(universeIds) {
  if (!universeIds.length) return [];
  const url = `https://thumbnails.roblox.com/v1/games/icons?universeIds=${universeIds.join(",")}&size=512x512&format=Png&isCircular=false`;
  const res = await axios.get(url);
  return res.data.data || [];
}

// Main portfolio API
app.get("/portfolio/:username", async (req, res) => {
  try {
    const username = req.params.username;
    const userId = await getUserId(username);

    // 1️⃣ User games
    const userGames = await fetchGames("users", userId);

    // 2️⃣ Owned groups
    const ownedGroups = await fetchOwnedGroups(userId);

    // 3️⃣ Group games
    let groupGames = [];
    for (const groupId of ownedGroups) {
      const gGames = await fetchGames("groups", groupId);
      groupGames.push(...gGames);
      await sleep(200); // prevent rate limits
    }

    // Merge all games
    const allGamesRaw = [...userGames, ...groupGames];

    // Map universeIds
    const universeIds = allGamesRaw.map(g => g.universeId || g.id);

    // Fetch details and thumbnails
    const details = await fetchGameDetails(universeIds);
    const thumbnails = await fetchThumbnails(universeIds);

    // Build final enriched array
    const finalGames = details.map(game => {
      const thumb = thumbnails.find(t => t.targetId === game.id);
      return {
        id: game.id,
        name: game.name,
        creator: game.creator.name,
        playing: game.playing,
        visits: game.visits,
        description: game.description || "No description provided",
        icon: thumb ? thumb.imageUrl : null
      };
    });

    res.json({ userId, games: finalGames });
  } catch (err) {
    console.error("Portfolio API error:", err.message);
    res.status(500).json({ error: "Failed to fetch portfolio data." });
  }
});

// Test route
app.get("/", (req, res) => {
  res.send("Server is alive! Use /portfolio/:username");
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
