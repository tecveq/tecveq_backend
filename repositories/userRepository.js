const User = require('../models/user');


class UserRepository {

    async findUserAndUpdatePasswordById(id, hashedPassword) {
        return await User.findByIdAndUpdate(
            id,
            {
                password: hashedPassword,
                isFirstLogin: false
            },
            { new: true }
        );
    }
}

module.exports = new UserRepository();
