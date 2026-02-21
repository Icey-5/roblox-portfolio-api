import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());

// Health check
app.get("/", (req, res) => {
  res.send("✅ Roblox API is alive!");
});

// Full user info endpoint
app.get("/user/:username", async (req, res) => {
  const username = req.params.username;

  try {
    // 1️⃣ Get userId
    const userRes = await fetch(`https://api.roblox.com/users/get-by-username?username=${username}`);
    const userData = await userRes.json();
    if (!userData.Id) return res.status(404).json({ error: "User not found" });

    const userId = userData.Id;

    // 2️⃣ Get user groups
    const groupsRes = await fetch(`https://groups.roblox.com/v2/users/${userId}/groups/roles`);
    const groupsData = await groupsRes.json();

    const groups = groupsData.data
      .map(g => ({
        groupId: g.group.id,
        name: g.group.name,
        description: g.group.description,
        rank: g.role.rank,
        roleName: g.role.name,
      }))
      .sort((a, b) => b.rank - a.rank); // sort by rank high -> low

    // 3️⃣ Get friends (active players)
    const friendsRes = await fetch(`https://friends.roblox.com/v1/users/${userId}/friends`);
    const friendsData = await friendsRes.json();

    // Optional: Check who is online
    const activePlayers = [];
    for (const friend of friendsData.data.slice(0, 10)) { // limit to first 10
      const presenceRes = await fetch(`https://presence.roblox.com/v1/presence/users?userIds=${friend.id}`);
      const presenceData = await presenceRes.json();
      const online = presenceData.userPresences[0]?.userPresenceType === 1; // 1 = online
      if (online) activePlayers.push({ username: friend.name, userId: friend.id });
    }

    res.json({
      username,
      userId,
      groups,
      activeFriends: activePlayers
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(PORT, () => console.log(`✅ Server running on PORT ${PORT}`));
