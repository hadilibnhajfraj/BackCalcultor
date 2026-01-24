const { Op, Sequelize } = require("sequelize"); // Correctly import Sequelize
const { User, FrpCalculation } = require("../models");

// Function to handle online users
exports.onlineUsers = async (req, res) => {
  try {
    const ONLINE_WINDOW_MIN = 2;
    const onlineSince = new Date(Date.now() - ONLINE_WINDOW_MIN * 60 * 1000);

    // 1) Fetch all users (excluding admin)
    const users = await User.findAll({
      where: {
        role: { [Op.ne]: "admin" }, // Optionally exclude 'admin' users
      },
      attributes: ["id", "username", "email", "role", "last_seen", "firstname", "lastname"],
      order: [["createdAt", "DESC"]],
      raw: true,
    });

    // 2) Get number of projects per user (group by userId)
    const counts = await FrpCalculation.findAll({
      attributes: [
        "userId",
        [Sequelize.fn("COUNT", Sequelize.col("id")), "projectsCount"], // Using Sequelize.fn and Sequelize.col
      ],
      group: ["userId"],
      raw: true,
    });

    // 3) Map the project counts by userId
    const mapCount = new Map(
      counts.map((c) => [String(c.userId), Number(c.projectsCount || 0)])
    );

    // 4) Add isOnline and projectsCount to each user
    const data = users.map((u) => {
      const lastSeen = u.last_seen ? new Date(u.last_seen) : null;
      const isOnline = lastSeen ? lastSeen >= onlineSince : false;

      return {
        ...u,
        isOnline,
        projectsCount: mapCount.get(String(u.id)) || 0,
      };
    });

    // 5) Sort by online status first, then by last_seen descending
    data.sort((a, b) => {
      if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
      const la = a.last_seen ? new Date(a.last_seen).getTime() : 0;
      const lb = b.last_seen ? new Date(b.last_seen).getTime() : 0;
      return lb - la;
    });

    return res.json({
      ok: true,
      meta: {
        totalUsers: data.length,
        onlineUsers: data.filter((x) => x.isOnline).length,
        onlineWindowMinutes: ONLINE_WINDOW_MIN,
      },
      data,
    });
  } catch (error) {
    console.error("Error fetching users list:", error);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};

// Function to manage a user (block, unblock, delete)
exports.manageUser = async (req, res) => {
  const { userId, action } = req.body; // action: "block", "unblock", "delete"
  
  if (!userId || !action) {
    return res.status(400).json({ ok: false, error: "Missing parameters" });
  }

  try {
    const user = await User.findByPk(userId); // Fetch user by primary key
    if (!user) return res.status(404).json({ ok: false, error: "User not found" });

    if (action === "delete") {
      await user.destroy(); // Delete the user
      return res.json({ ok: true, message: "User successfully deleted" });
    }

    if (action === "block") {
      user.isBlocked = true; // Block the user
      await user.save(); // Save the updated user status
      return res.json({ ok: true, message: "User successfully blocked" });
    }

    if (action === "unblock") {
      user.isBlocked = false; // Unblock the user
      await user.save(); // Save the updated user status
      return res.json({ ok: true, message: "User successfully unblocked" });
    }

    return res.status(400).json({ ok: false, error: "Unknown action" });
  } catch (error) {
    console.error("Error managing user:", error);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};

// Function to fetch FRP projects for a user
exports.frpByUser = async (req, res) => {
  try {
    const userId = Number(req.params.userId); // Ensure userId is a number
    if (!userId) return res.status(400).json({ ok: false, error: "Invalid userId" });

    const { type } = req.query; // Get the project type (e.g., "poutre", "dalle")
    const where = { userId };
    if (type) where.elementType = type; // Filter by project type if provided

    const rows = await FrpCalculation.findAll({
      where,
      order: [["created_at", "DESC"]], // Order by creation date
      limit: 200, // Limit the results to 200
    });

    return res.json({ ok: true, data: rows }); // Return the fetched FRP projects
  } catch (error) {
    console.error("Error fetching FRP projects:", error);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};

// Function to get FRP stats (could be summarized data or general stats)
exports.frpStats = async (req, res) => {
  try {
    const stats = await FrpCalculation.aggregate("amount", "sum", {
      where: { userId: req.user.id }, // Assuming user info is added via auth middleware
      raw: true,
    });

    return res.json({ ok: true, data: stats }); // Return aggregated stats (like total amount)
  } catch (error) {
    console.error("Error fetching FRP stats:", error);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};

// Function to list all FRP projects
exports.frpList = async (req, res) => {
  try {
    const frpList = await FrpCalculation.findAll({
      order: [["created_at", "DESC"]], // Order by creation date
      limit: 100, // Limit to first 100 records
    });

    return res.json({ ok: true, data: frpList }); // Return the list of FRP projects
  } catch (error) {
    console.error("Error fetching FRP projects:", error);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};

// Function to provide an overview (could be general dashboard stats)
exports.overview = async (req, res) => {
  try {
    // Fetch some basic statistics for overview
    const userCount = await User.count();
    const activeUserCount = await User.count({ where: { last_seen: { [Op.gte]: new Date(Date.now() - 2 * 60 * 1000) } } });

    return res.json({ ok: true, data: { userCount, activeUserCount } });
  } catch (error) {
    console.error("Error fetching overview data:", error);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};
