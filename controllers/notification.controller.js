import Notification from "./../models/notification.model.js";

export const getNotifications = async (req, res) => {
  try {
    const userId = req.user._id;

    const notifications = await Notification.find({ to: userId })
      .sort({ createdAt: -1 })
      .populate({
        path: "from",
        select: "username profileImg",
      });

    await Notification.updateMany({ to: userId }, { read: true });

    const filterNotifications = notifications.filter(
      (notification) => notification.from._id.toString() !== userId.toString()
    );

    return res.status(200).json(filterNotifications);
  } catch (error) {
    console.log("Error in getNotifications controller", error.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const deleteNotifications = async (req, res) => {
  try {
    const userId = req.user._id;

    await Notification.deleteMany({ to: userId });

    return res.status(200).json({
      message: "Notifications deleted successfully",
    });
  } catch (error) {
    console.log("Error in deleteNotifications controller", error.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const deleteNotification = async (req, res) => {
  try {
    const notificationId = req.params.id;
    const userId = req.user._id;
    const notification = await Notification.findById(notificationId);

    if (!notification) {
      return res.status(404).json({
        error: "Notification not found",
      });
    }

    if (notification.to.toString() !== userId.toString()) {
      return res.status(403).json({
        error: "You are not allowed to delete this notification",
      });
    }

    await Notification.findByIdAndDelete(notificationId);
    return res.status(200).json({
      message: "Notification deleted successfully",
    });
  } catch (error) {
    console.log("Error in deleteNotification controller", error.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
