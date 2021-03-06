/**
@module @ember/array
*/

import {
  get,
  computed,
  _beforeObserver,
  observer,
  alias
} from 'ember-metal';
import {
  isArray
} from '../utils';
import EmberObject from './object';
import MutableArray from '../mixins/mutable_array';
import {
  addArrayObserver,
  removeArrayObserver,
  objectAt
} from '../mixins/array';
import { assert } from 'ember-debug';

/**
  An ArrayProxy wraps any other object that implements `Array` and/or
  `MutableArray,` forwarding all requests. This makes it very useful for
  a number of binding use cases or other cases where being able to swap
  out the underlying array is useful.

  A simple example of usage:

  ```javascript
  import { A } from '@ember/array';
  import ArrayProxy from '@ember/array/proxy';

  let pets = ['dog', 'cat', 'fish'];
  let ap = ArrayProxy.create({ content: A(pets) });

  ap.get('firstObject');                        // 'dog'
  ap.set('content', ['amoeba', 'paramecium']);
  ap.get('firstObject');                        // 'amoeba'
  ```

  This class can also be useful as a layer to transform the contents of
  an array, as they are accessed. This can be done by overriding
  `objectAtContent`:

  ```javascript
  import { A } from '@ember/array';
  import ArrayProxy from '@ember/array/proxy';

  let pets = ['dog', 'cat', 'fish'];
  let ap = ArrayProxy.create({
      content: A(pets),
      objectAtContent: function(idx) {
          return this.get('content').objectAt(idx).toUpperCase();
      }
  });

  ap.get('firstObject'); // . 'DOG'
  ```

  @class ArrayProxy
  @extends EmberObject
  @uses MutableArray
  @public
*/
export default EmberObject.extend(MutableArray, {

  /**
    The content array. Must be an object that implements `Array` and/or
    `MutableArray.`

    @property content
    @type EmberArray
    @public
  */
  content: null,

  /**
   The array that the proxy pretends to be. In the default `ArrayProxy`
   implementation, this and `content` are the same. Subclasses of `ArrayProxy`
   can override this property to provide things like sorting and filtering.

   @property arrangedContent
   @public
  */
  arrangedContent: alias('content'),

  /**
    Should actually retrieve the object at the specified index from the
    content. You can override this method in subclasses to transform the
    content item to something new.

    This method will only be called if content is non-`null`.

    @method objectAtContent
    @param {Number} idx The index to retrieve.
    @return {Object} the value or undefined if none found
    @public
  */
  objectAtContent(idx) {
    return objectAt(get(this, 'arrangedContent'), idx);
  },

  /**
    Should actually replace the specified objects on the content array.
    You can override this method in subclasses to transform the content item
    into something new.

    This method will only be called if content is non-`null`.

    @method replaceContent
    @param {Number} idx The starting index
    @param {Number} amt The number of items to remove from the content.
    @param {EmberArray} objects Optional array of objects to insert or null if no
      objects.
    @return {void}
    @private
  */
  replaceContent(idx, amt, objects) {
    get(this, 'content').replace(idx, amt, objects);
  },

  _arrangedContentWillChange: _beforeObserver('arrangedContent', function() {
    let arrangedContent = get(this, 'arrangedContent');
    let len = arrangedContent ? get(arrangedContent, 'length') : 0;

    this.arrangedContentArrayWillChange(this, 0, len, undefined);

    this._teardownArrangedContent(arrangedContent);
  }),

  _arrangedContentDidChange: observer('arrangedContent', function() {
    let arrangedContent = get(this, 'arrangedContent');
    let len = arrangedContent ? get(arrangedContent, 'length') : 0;

    this._setupArrangedContent();

    this.arrangedContentArrayDidChange(this, 0, undefined, len);
  }),

  _setupArrangedContent() {
    let arrangedContent = get(this, 'arrangedContent');

    if (arrangedContent) {
      assert('Can\'t set ArrayProxy\'s content to itself', arrangedContent !== this);
      assert(`ArrayProxy expects an Array or ArrayProxy, but you passed ${typeof arrangedContent}`,
        isArray(arrangedContent) || arrangedContent.isDestroyed);

      addArrayObserver(arrangedContent, this, {
        willChange: 'arrangedContentArrayWillChange',
        didChange: 'arrangedContentArrayDidChange'
      });
    }
  },

  _teardownArrangedContent() {
    let arrangedContent = get(this, 'arrangedContent');

    if (arrangedContent) {
      removeArrayObserver(arrangedContent, this, {
        willChange: 'arrangedContentArrayWillChange',
        didChange: 'arrangedContentArrayDidChange'
      });
    }
  },

  objectAt(idx) {
    return get(this, 'content') && this.objectAtContent(idx);
  },

  length: computed(function() {
    let arrangedContent = get(this, 'arrangedContent');
    return arrangedContent ? get(arrangedContent, 'length') : 0;
    // No dependencies since Enumerable notifies length of change
  }),

  replace(idx, amt, objects) {
    assert('Mutating an arranged ArrayProxy is not allowed', get(this, 'arrangedContent') === get(this, 'content') );
    this.replaceContent(idx, amt, objects);
  },

  arrangedContentArrayWillChange(item, idx, removedCnt, addedCnt) {
    this.arrayContentWillChange(idx, removedCnt, addedCnt);
  },

  arrangedContentArrayDidChange(item, idx, removedCnt, addedCnt) {
    this.arrayContentDidChange(idx, removedCnt, addedCnt);
  },

  init() {
    this._super(...arguments);
    this._setupArrangedContent();
  },

  willDestroy() {
    this._teardownArrangedContent();
  }
});
