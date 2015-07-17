'use strict';

var _ = require('lodash');

module.exports = function (bookshelf) {
  var Model = bookshelf.Model,
      Collection = bookshelf.Collection,
      mProto = bookshelf.Model.prototype,
      cProto = bookshelf.Collection.prototype;

  bookshelf.withTransaction = function(cb) {
    bookshelf.transaction(function(trx) {
      var model = function(name) {
        var model = bookshelf.model(name);
        return model ? model.extend({_transaction: trx}) : model;
      };

      var collection = function(name) {
        var collection = bookshelf.collection(name);
        return collection.extend({_transaction: trx});
      };

      return cb({
        model: model, collection: collection, transaction: trx
      });
    });
  };

  function extendModel(model) {
    if (typeof input === 'string') {
      model =
        bookshelf.collection(name) || bookshelf(model) || (function() {
          throw new Error('The model ' + model + ' could not be resolved from the registry plugin.');
        });
    }

    if (this._transaction) {
      return model.extend({ _transaction: this._transaction });
    }

    return model;
  }

  // Re-implement the `bookshelf.Model` relation methods to include a check for the registered model.
  _.each(['hasMany', 'hasOne', 'belongsToMany', 'morphOne', 'morphMany', 'belongsTo', 'through'], function(method) {
    var original = Model.prototype[method];
    Model.prototype[method] = function(Target) {
      // The first argument is always a model, so resolve it and call the original method.
      return original.call(this, [extendModel.call(this, Target)].concat(_.rest(arguments)));
    };
  });

  // `morphTo` takes the relation name first, and then a variadic set of models so we
  // can't include it with the rest of the relational methods.
  var morphTo = Model.prototype.morphTo;
  Model.prototype.morphTo = function(relationName) {
    return morphTo.apply(this, [relationName].concat(_.map(_.rest(arguments), function(model) {
      return extendModel.call(this, model);
    }, this)));
  };

  // The `through` method exists on the Collection as well, for `hasMany` / `belongsToMany` through relations.
  var collectionThrough = Collection.prototype.through;
  Collection.prototype.through = function(Target) {
    return collectionThrough.apply(this, [extendModel.call(this, Target)].concat(_.rest(arguments)));
  };

  function applyTransaction(opts) {
    if (this._transaction) {
      opts = opts || {};
      opts.transacting = this._transaction;
    }
  }

  bookshelf.Model = Model.extend({
    fetch: function (opts) {
      applyTransaction.call(this, opts);
      return mProto.fetch.apply(this, arguments);
    },

    fetchAll: function (opts) {
      applyTransaction.call(this, opts);
      return mProto.fetchAll.apply(this, arguments);
    },

    fetchOne: function (opts) {
      applyTransaction.call(this, opts);
      return mProto.fetchOne.apply(this, arguments);
    },

    save: function (params, opts) {
      applyTransaction.call(this, opts);
      return mProto.fetchOne.apply(this, arguments);
    }
  });

  bookshelf.collection = Collection.extend({
    fetch: function (opts) {
      applyTransaction.call(this, opts);
      return cProto.fetch.apply(this, arguments);
    },

    fetchOne: function (opts) {
      applyTransaction.call(this, opts);
      return cProto.fetchOne.apply(this, arguments);
    }
  });
};
