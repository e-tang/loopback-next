// Copyright IBM Corp. 2018. All Rights Reserved.
// Node module: @loopback/repository-json-schema
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {
  belongsTo,
  Entity,
  hasMany,
  model,
  property,
} from '@loopback/repository';
import {expect} from '@loopback/testlab';
import * as Ajv from 'ajv';
import {JsonSchema, modelToJsonSchema} from '../..';

describe('build-schema', () => {
  describe('modelToJsonSchema', () => {
    it('converts basic model', () => {
      @model()
      class TestModel {
        @property()
        foo: string;
      }

      const jsonSchema = modelToJsonSchema(TestModel);
      expectValidJsonSchema(jsonSchema);
      expect(jsonSchema.properties).to.containDeep({
        foo: <JsonSchema>{
          type: 'string',
        },
      });
    });

    it('handles circular references', () => {
      @model()
      class Category {
        @property.array(() => Product)
        products?: Product[];
      }

      @model()
      class Product {
        @property(() => Category)
        category?: Category;
      }

      const schema = modelToJsonSchema(Category);
      expect(schema).to.deepEqual({
        title: 'Category',
        properties: {
          products: {
            type: 'array',
            items: {$ref: '#/definitions/Product'},
          },
        },
        definitions: {
          Product: {
            title: 'Product',
            properties: {
              category: {
                $ref: '#/definitions/Category',
              },
            },
          },
        },
      });
    });

    it('converts HasMany and BelongsTo relation links', () => {
      @model()
      class Product extends Entity {
        @property({id: true})
        id: number;

        @belongsTo(() => Category)
        categoryId: number;
      }

      @model()
      class Category extends Entity {
        @property({id: true})
        id: number;

        @hasMany(() => Product)
        products?: Product[];
      }

      const jsonSchema = modelToJsonSchema(Category, {includeRelations: true});
      expectValidJsonSchema(jsonSchema);
      expect(jsonSchema).to.deepEqual({
        title: 'CategoryWithRelations',
        properties: {
          // TODO(bajtos): inherit these properties from Category schema
          // See https://swagger.io/docs/specification/data-models/inheritance-and-polymorphism/
          id: {type: 'number'},
          products: {
            type: 'array',
            items: {$ref: '#/definitions/ProductWithRelations'},
          },
        },
        definitions: {
          ProductWithRelations: {
            title: 'ProductWithRelations',
            properties: {
              // TODO(bajtos): inherit these properties from Product schema
              // See https://swagger.io/docs/specification/data-models/inheritance-and-polymorphism/
              id: {type: 'number'},
              categoryId: {type: 'number'},
              category: {$ref: '#/definitions/CategoryWithRelations'},
            },
          },
        },
      });
    });
  });
});

function expectValidJsonSchema(schema: JsonSchema) {
  const ajv = new Ajv();
  const validate = ajv.compile(
    require('ajv/lib/refs/json-schema-draft-06.json'),
  );
  const isValid = validate(schema);
  const result = isValid
    ? 'JSON Schema is valid'
    : ajv.errorsText(validate.errors!);
  expect(result).to.equal('JSON Schema is valid');
}
