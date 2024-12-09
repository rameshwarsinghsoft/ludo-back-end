const { CatchError } = require('../utils/Response');

class CrudRepository {
    constructor(model) {
        this.model = model;
    }

    async create(data) {
        try {
            return await this.model.create(data);
        } catch (error) {
            CatchError(error);
        }
    }

    async save(data) {
        try {
            const document = new this.model(data);
            return await document.save();
        } catch (error) {
            CatchError(error);
        }
    }

    async bulkCreate(dataArray) {
        try {
            return await this.model.insertMany(dataArray);
        } catch (error) {
            CatchError(error);
        }
    }

    async findBy(criteria) {
        try {
            return await this.model.findOne(criteria);
        } catch (error) {
            CatchError(error);
        }
    }

    async findAll() {
        try {
            return await this.model.find();
        } catch (error) {
            CatchError(error);
        }
    }

    async find(criteria = null) {
        try {
            if (criteria) {
                const data = await this.model.findOne(criteria);
                // but return as an []
                return data ? [data] : []
            } else {
                return await this.model.find();
            }
        } catch (error) {
            CatchError(error);
        }
    }

    async updateBy(criteria, updateData) {
        try {
            return await this.model.findOneAndUpdate(
                criteria,
                { $set: updateData },
                { new: true }
            );
        } catch (error) {
            CatchError(error);
        }
    }

    async toggleActiveStatus(criteria) {
        try {
            const resource = await this.model.findOne(criteria);
            return await this.model.findOneAndUpdate(
                criteria,
                { $set: { is_active: !resource.is_active } },
                { new: true }
            );
        } catch (error) {
            CatchError(error);
        }
    }
    
    async softdelete(criteria) {
        try {
            return await this.model.findOneAndUpdate(
                criteria,
                { $set: { is_delete: true } },
                { new: true }
            );
        } catch (error) {
            CatchError(error);
        }
    }

    async deleteOne(criteria) {
        try {
            return await this.model.deleteOne(criteria);
        } catch (error) {
            CatchError(error);
        }
    }

    async deleteMany(criteria) {
        try {
            return await this.model.deleteMany(criteria);
        } catch (error) {
            CatchError(error);
        }
    }
}

module.exports = CrudRepository;