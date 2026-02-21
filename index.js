const express = require("express");
const fetch = require("node-fetch");

const app = express();

async function getCreatedGames(userId) {
    const res = await fetch(
        `https://games.roblox.com/v2/users/${userId}/games?accessFilter=Public&limit=50`
    );
    const data = await res.json();
    return data.data || [];
}

async function getUserGroups(userId) {
    const res = await fetch(
        `https://groups.roblox.com/v2/users/${userId}/groups/roles`
    );
    const data = await res.json();
    return data.data || [];
}

async function getGroupGames(groupId) {
    const res = await fetch(
        `https://games.roblox.com/v2/groups/${groupId}/games?accessFilter=Public&limit=50`
    );
    const data = await res.json();
    return data.data || [];
}

async function getGameDetails(universeIds) {
    const res = await fetch(
        `https://games.roblox.com/v1/games?universeIds=${universeIds.join(",")}`
    );
    const data = await res.json();
    return data.data || [];
}

async function getThumbnails(universeIds) {
    const res = await fetch(
        `https://thumbnails.roblox.com/v1/games/icons?universeIds=${universeIds.join(",")}&size=512x512&format=Png&isCircular=false`
    );
    const data = await res.json();
    return data.data || [];
}

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

        if (universeIds.length === 0) {
            return res.json({ games: [] });
        }

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

app.listen(3000, () => console.log("Server running"));
