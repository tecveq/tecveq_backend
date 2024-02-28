exports.getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({
      deliveredTo: req.user._id,
    })
      .populate("sentBy")
      .sort({ createdAt: -1 });

    res.status(200).json(
      notifications.map((not) => {
        return {
          ...not._doc,
          deliveredTo: undefined,
          readBy: undefined,
          isRead: not.readBy.includes(req.user._id),
        };
      })
    );
  } catch (err) {
    res.status(500).json(err);
  }
};
