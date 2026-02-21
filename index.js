// index.js — Updated Roblox Portfolio API
const express = require("express");
const fetch = require("node-fetch");
const app = express();

// Fetch places owned by user
async function getUserPlaces(userId) {
    const res = await fetch(
        `https://users.roblox.com/v1/users/${userId}/places`
    );
    const data = await res.json();
    return data.data || [];
}

// Fetch game details given universe IDs
async function getGameDetails(universeIds) {
    if (!universeIds.length) return [];
    const res = await fetch(
        `https://games.roblox.com/v1/games?universeIds=${universeIds.join(",")}`
    );
    const data = await res.json();
    return data.data || [];
}

// Fetch thumbnails for game icons
async function getThumbnails(universeIds) {
    if (!universeIds.length) return [];
    const res = await fetch(
        `https://thumbnails.roblox.com/v1/games/icons?universeIds=${universeIds.join(",")}&size=512x512&format=Png&isCircular=false`
    );
    const data = await res.json();
    return data.data || [];
}

// Main portfolio route
app.get("/portfolio/:userId", async (req, res) => {
    try {
        const userId = req.params.userId;

        // Step A — fetch user places
        const places = await getUserPlaces(userId);

        // If no places, return empty
        if (!places.length) {
            return res.json({ games: [] });
        }

        // Gather universe IDs
        const universeIds = places.map(p => p.universeId);

        // Step B — fetch details
        const details = await getGameDetails(universeIds);

        // Step C — thumbnails
        const thumbnails = await getThumbnails(universeIds);

        // Build final list
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
        console.error("PORTFOLIO API ERROR:", err);
        res.status(500).json({ error: "Failed to fetch portfolio data." });
    }
});

// Test route
app.get("/", (req, res) => {
    res.send("Server is live! Use /portfolio/:userId");
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
