// index.js
const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// Cloud Run expects this port
const PORT = process.env.PORT || 8080;

// Delay function for rate limiting
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Roblox API helper
async function fetchJSON(url, headers = {}) {
  const res = await axios.get(url, { headers });
  return res.data;
}

// Get userId from username
async function getUserId(username) {
  const res = await axios.post("https://users.roblox.com/v1/usernames/users", {
    usernames: [username],
    excludeBannedUsers: false,
  });
  const user = res.data.data[0];
  if (user && user.id) return user.id;
  throw new Error("User not found");
}

// Get groups where user is owner
async function getOwnedGroups(userId) {
  try {
    const url = `https://groups.roblox.com/v1/users/${userId}/groups/roles`;
    const data = await fetchJSON(url);
    return data.data.filter(g => g.role.rank === 255).map(g => g.group.id);
  } catch (err) {
    console.error(`Failed to fetch groups for ${userId}:`, err.message);
    return [];
  }
}

// Fetch all games for user or group, paginated
async function fetchGames(ownerType, ownerId) {
  let cursor = "";
  let games = [];
  let hasMore = true;

  while (hasMore) {
    try {
      const url = `https://games.roblox.com/v2/${ownerType}/${ownerId}/games?sortOrder=Asc&limit=50${cursor ? `&cursor=${cursor}` : ""}`;
      const data = await fetchJSON(url);

      if (data.data?.length) {
        games.push(...data.data);
      }

      if (data.nextPageCursor) {
        cursor = data.nextPageCursor;
      } else {
        hasMore = false;
      }
    } catch (err) {
      console.error(`Failed to fetch games for ${ownerType} ${ownerId}:`, err.message);
      hasMore = false;
    }
  }
  return games;
}

// Get universe stats: visits, likes, dislikes
async function enrichGames(games) {
  const enriched = [];
  for (const game of games) {
    let universeId = game.universeId || null;
    if (!universeId) {
      // fetch universeId if missing
      try {
        const res = await fetchJSON(`https://apis.roblox.com/universes/v1/places/${game.id}/universe`);
        universeId = res.universeId;
      } catch (err) {
        console.warn(`Failed to fetch universeId for place ${game.id}: ${err.message}`);
      }
    }

    let visits = "N/A";
    let likes = "N/A";
    let dislikes = "N/A";
    let isActive = game.isActive ?? true;

    if (universeId) {
      try {
        const statsRes = await fetchJSON(`https://games.roblox.com/v1/games?universeIds=${universeId}`);
        const stats = statsRes.data?.[0];
        if (stats) {
          visits = stats.visits ?? "N/A";
          likes = stats.voteCount?.upVotes ?? "N/A";
          dislikes = stats.voteCount?.downVotes ?? "N/A";
          isActive = stats.isActive ?? true;
        }
        await sleep(250); // avoid rate limits
      } catch (err) {
        console.warn(`Failed to fetch stats for universe ${universeId}: ${err.message}`);
      }
    }

    enriched.push({
      name: game.name,
      placeId: game.id,
      universeId: universeId || "N/A",
      visits,
      likes,
      dislikes,
      thumbnail: `https://thumbnails.roblox.com/v1/places/${game.id}/thumbnail?size=768x432&format=png`,
      created: game.created,
      isArchived: game.isArchived,
      isActive
    });
  }
  return enriched;
}

// Root route
app.get("/", (req, res) => {
  res.send("Server is alive! Use /portfolio/:username");
});

// Portfolio route
app.get("/portfolio/:username", async (req, res) => {
  try {
    const username = req.params.username;
    if (!username) return res.status(400).json({ error: "Username required" });

    const userId = await getUserId(username);

    // 1️⃣ Fetch user's own games
    let allGames = await fetchGames("users", userId);

    // 2️⃣ Fetch owned groups and their games
    const groups = await getOwnedGroups(userId);
    for (const groupId of groups) {
      const groupGames = await fetchGames("groups", groupId);
      allGames.push(...groupGames);
    }

    // 3️⃣ Enrich all games with stats
    const enrichedGames = await enrichGames(allGames);

    res.json({ userId, username, totalGames: enrichedGames.length, games: enrichedGames });
  } catch (err) {
    console.error("Error in /portfolio/:username:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
