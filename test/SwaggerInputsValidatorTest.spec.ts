import request from 'supertest';
import express, {
  Application,
  Response,
  Request,
  RequestHandler,
} from 'express';
import assert from 'assert';
import bodyParser from 'body-parser';

import { Validator } from '../src';

describe('Wrong instantiations', () => {
  it('should crash if bad swagger file is specified', (done) => {
    assert.throws(function () {
      new Validator.SwaggerInputsValidator('fake object');
    });
    done();
  });

  it('should crash if swagger file without paths variable is specified', (done) => {
    assert.throws(function () {
      new Validator.SwaggerInputsValidator({
        swagger: '2.0',
        info: {
          title: 'Uber API',
          description: 'Move your app forward with the Uber API',
          version: '1.0.0',
        },
        host: 'api.uber.com',
        schemes: ['https'],
        basePath: '/v1',
        produces: ['application/json'],
      });
    });
    done();
  });
});

describe('good instanciation', () => {
  var swaggerFile: any;
  before(() => {
    swaggerFile = require('../swagger-examples/UberAPI.json');
  });

  it('should NOT crash if valid swagger is passed', (done) => {
    new Validator.SwaggerInputsValidator(swaggerFile);
    done();
  });

  it('should NOT crash if valid swagger is passed + valid onError function', (done) => {
    new Validator.SwaggerInputsValidator(swaggerFile, {
      onError: function (errors, req, res) {},
    });
    done();
  });

  it('should NOT crash if valid swagger is passed + valid strict variable', (done) => {
    new Validator.SwaggerInputsValidator(swaggerFile, { strict: false });
    done();
  });

  it('should NOT crash if valid swagger is passed + valid strict variable + valid onError function', (done) => {
    new Validator.SwaggerInputsValidator(swaggerFile, {
      strict: false,
      onError: function (errors, req, res) {},
    });
    done();
  });

  it('should NOT crash if valid swagger is passed + valid strict variable + valid onError function + valid allowNull', (done) => {
    new Validator.SwaggerInputsValidator(swaggerFile, {
      strict: false,
      allowNull: true,
      onError: function (errors, req, res) {},
    });
    done();
  });
});

describe('When parameters are missing', () => {
  var server: Application;
  var swaggerFile: any;
  before(() => {
    swaggerFile = require('../swagger-examples/UberAPI.json');
  });

  it('should return an HTTP 400 code when only one parameter is missing (GET/query) 1', (done) => {
    server = createFakeServer(
      new Validator.SwaggerInputsValidator(swaggerFile, {
        onError: errorHandler,
      }).get('/products')
    );
    request
      .agent(server)
      .get('/v1/products?longitude=50')
      .expect(400, 'Error: Parameter : latitude is not specified.\n')
      .end(done);
  });

  it('should return an HTTP 400 code when only one parameter is missing (GET/query) 2', (done) => {
    server = createFakeServer(
      new Validator.SwaggerInputsValidator(swaggerFile, {
        onError: errorHandler,
      }).get('/products')
    );
    request
      .agent(server)
      .get('/v1/products?latitude=50')
      .expect(400, 'Error: Parameter : longitude is not specified.\n')
      .end(done);
  });

  it('should return an HTTP 400 code when all parameters are missing (GET/query)', (done) => {
    server = createFakeServer(
      new Validator.SwaggerInputsValidator(swaggerFile, {
        onError: errorHandler,
      }).get('/products')
    );
    request
      .agent(server)
      .get('/v1/products')
      .expect(
        400,
        'Error: Parameter : latitude is not specified.,Error: Parameter : longitude is not specified.\n'
      )
      .end(done);
  });

  it('should return an HTTP 400 code when parameters are missing (POST / query + formData)', (done) => {
    server = createFakeServer(
      new Validator.SwaggerInputsValidator(swaggerFile, {
        onError: errorHandler,
      }).post('/users')
    );
    request
      .agent(server)
      .post('/v1/users?name=Bart')
      .set('Content-Type', 'application/json')
      .send({ age: 9 })
      .expect(
        400,
        'Error: Parameter : surname is not specified.,Error: Parameter : sister is not specified.\n'
      )
      .end(done);
  });

  it('should return an HTTP 400 code when parameters are missing (PUT / query + formData)', (done) => {
    server = createFakeServer(
      new Validator.SwaggerInputsValidator(swaggerFile, {
        onError: errorHandler,
      }).put('/users')
    );
    request
      .agent(server)
      .put('/v1/users?surname=Simpson')
      .set('Content-Type', 'application/json')
      .send({ sister: 'Lisa' })
      .expect(
        400,
        'Error: Parameter : name is not specified.,Error: Parameter : age is not specified.\n'
      )
      .end(done);
  });

  it('should return an HTTP 400 code when parameters are missing (DELETE / query)', (done) => {
    server = createFakeServer(
      new Validator.SwaggerInputsValidator(swaggerFile, {
        onError: errorHandler,
      }).delete('/users')
    );
    request
      .agent(server)
      .delete('/v1/users?surname=Simpson')
      .expect(400, 'Error: Parameter : name is not specified.\n')
      .end(done);
  });

  it('should return an HTTP 400 code when parameters are missing in body (no encapsulation)', (done) => {
    server = createFakeServer(
      new Validator.SwaggerInputsValidator(swaggerFile, {
        onError: errorHandler,
      }).post('/orders')
    );
    request
      .agent(server)
      .post('/v1/orders')
      .set('Content-Type', 'application/json')
      .send({ sister: 'Lisa' })
      .expect(
        400,
        'Error: Parameter : Playload within the body does not respect its type.\n'
      )
      .end(done);
  });
});

describe('format testing', () => {
  var server: Application;
  var swaggerFile: any;
  before(() => {
    swaggerFile = require('../swagger-examples/UberAPI.json');
  });

  it('should block request waiting for a non proper double', (done) => {
    server = createFakeServer(
      new Validator.SwaggerInputsValidator(swaggerFile, {
        onError: errorHandler,
      }).get('/products')
    );
    request
      .agent(server)
      .get('/v1/products?longitude=50.0.0&latitude=50')
      .expect(400, 'Error: Parameter : longitude does not respect its type.\n')
      .end(done);
  });

  it('should block request waiting for double and sending instead string', (done) => {
    server = createFakeServer(
      new Validator.SwaggerInputsValidator(swaggerFile, {
        onError: errorHandler,
      }).get('/products')
    );
    request
      .agent(server)
      .get('/v1/products?longitude=should not work&latitude=50')
      .expect(400, 'Error: Parameter : longitude does not respect its type.\n')
      .end(done);
  });

  it('should block request waiting for integer and sending a float', (done) => {
    server = createFakeServer(
      new Validator.SwaggerInputsValidator(swaggerFile, {
        onError: errorHandler,
      }).get('/products')
    );
    request
      .agent(server)
      .get('/v1/products?longitude=50&latitude=50&optionalInt=50.50')
      .expect(
        400,
        'Error: Parameter : optionalInt does not respect its type.\n'
      )
      .end(done);
  });

  it('should block request waiting for integer and sending a string', (done) => {
    server = createFakeServer(
      new Validator.SwaggerInputsValidator(swaggerFile, {
        onError: errorHandler,
      }).get('/products')
    );
    request
      .agent(server)
      .get('/v1/products?longitude=50&latitude=50&optionalInt=shouldGoInError')
      .expect(
        400,
        'Error: Parameter : optionalInt does not respect its type.\n'
      )
      .end(done);
  });

  it('should block request waiting for integer (in formData) and sending a string', (done) => {
    server = createFakeServer(
      new Validator.SwaggerInputsValidator(swaggerFile, {
        onError: errorHandler,
      }).post('/users')
    );
    request
      .agent(server)
      .post('/v1/users?name=Bart&surname=Simpson')
      .set('Content-Type', 'application/json')
      .send({ sister: 'Lisa', age: 'should be an int' })
      .expect(400, 'Error: Parameter : age does not respect its type.\n')
      .end(done);
  });

  it('should block request waiting for an int (in path) and sending a string', (done) => {
    var app = express();
    app.get(
      '/v1/users/:id',
      new Validator.SwaggerInputsValidator(swaggerFile, {
        onError: errorHandler,
      }).get('/users/:id'),
      function (req, res) {
        res.status(200).json({
          success:
            'If you can enter here, it means that the swagger middleware let you do so',
        });
      }
    );

    request
      .agent(app)
      .get('/v1/users/ShouldNotWork')
      .expect(400, 'Error: Parameter : id does not respect its type.\n')
      .end(done);
  });

  it('should block request waiting for boolean (in formData) and sending a string', (done) => {
    server = createFakeServer(
      new Validator.SwaggerInputsValidator(swaggerFile, {
        onError: errorHandler,
      }).post('/users')
    );
    request
      .agent(server)
      .post('/v1/users?name=Bart&surname=Simpson')
      .set('Content-Type', 'application/json')
      .send({ sister: 'Lisa', age: '10', optionalBoolean: 'shouldNotWork' })
      .expect(
        400,
        'Error: Parameter : optionalBoolean does not respect its type.\n'
      )
      .end(done);
  });

  it('should NOT block request waiting for boolean (as formData) and sending a string which looks like a boolean', (done) => {
    server = createFakeServer(
      new Validator.SwaggerInputsValidator(swaggerFile, {
        onError: errorHandler,
      }).post('/users')
    );
    request
      .agent(server)
      .post('/v1/users?name=Bart&surname=Simpson')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send({ sister: 'Lisa', age: '10', optionalBoolean: 'true' })
      .expect(200, {
        success:
          'If you can enter here, it means that the swagger middleware let you do so',
      })
      .end(done);
  });

  it("should block request when complex object is sent within the body and don't respect its type 1", (done) => {
    server = createFakeServer(
      new Validator.SwaggerInputsValidator(swaggerFile, {
        onError: errorHandler,
      }).post('/estimates/time')
    );
    request
      .agent(server)
      .post('/v1/estimates/time')
      .set('Content-Type', 'application/json')
      .send({
        time: { code: 'wrongType', message: 'message', fields: 'fields' },
      })
      .expect(400, 'Error: Parameter : time does not respect its type.\n')
      .end(done);
  });

  it("should block request when complex object is sent within the body and don't respect its type 2", (done) => {
    server = createFakeServer(
      new Validator.SwaggerInputsValidator(swaggerFile, {
        onError: errorHandler,
      }).post('/estimates/time')
    );
    request
      .agent(server)
      .post('/v1/estimates/time')
      .set('Content-Type', 'application/json')
      .send({
        time: { code: 'wrongType', message: 'message', fields: 'fields' },
      })
      .expect(400, 'Error: Parameter : time does not respect its type.\n')
      .end(done);
  });

  it("should block request when complex object is sent within the body and don't respect its type (second level)", (done) => {
    server = createFakeServer(
      new Validator.SwaggerInputsValidator(swaggerFile, {
        onError: errorHandler,
      }).post('/estimates/time')
    );
    request
      .agent(server)
      .post('/v1/estimates/time')
      .set('Content-Type', 'application/json')
      .send({
        time: {
          code: 30,
          message: 'message',
          fields: 'fields',
          optional: {
            sub_prop1: 'goodType',
            sub_prop2: 'WrongType',
          },
        },
      })
      .expect(400, 'Error: Parameter : time does not respect its type.\n')
      .end(done);
  });

  it('should block request when waiting for an array of string and sending array of int', (done) => {
    server = createFakeServer(
      new Validator.SwaggerInputsValidator(swaggerFile, {
        onError: errorHandler,
      }).post('/estimates/time')
    );
    request
      .agent(server)
      .post('/v1/estimates/time')
      .set('Content-Type', 'application/json')
      .send({
        time: {
          code: 30,
          message: 'message',
          fields: 'fields',
          optionalArray: [10, 20, 30],
        },
      })
      .expect(400, 'Error: Parameter : time does not respect its type.\n')
      .end(done);
  });

  it('should block request when waiting for an array of string and sending a mixed array ', (done) => {
    server = createFakeServer(
      new Validator.SwaggerInputsValidator(swaggerFile, {
        onError: errorHandler,
      }).post('/estimates/time')
    );
    request
      .agent(server)
      .post('/v1/estimates/time')
      .set('Content-Type', 'application/json')
      .send({
        time: {
          code: 30,
          message: 'message',
          fields: 'fields',
          optionalArray: [10, 'Wrong type', 30],
        },
      })
      .expect(400, 'Error: Parameter : time does not respect its type.\n')
      .end(done);
  });

  it('should return an HTTP 400 code when parameters in body do not respet their type (no encapsulation)', (done) => {
    server = createFakeServer(
      new Validator.SwaggerInputsValidator(swaggerFile, {
        onError: errorHandler,
      }).post('/orders')
    );
    request
      .agent(server)
      .post('/v1/orders')
      .set('Content-Type', 'application/json')
      .send({ code: 'WrongType', message: 'ok', fields: 'ok' })
      .expect(
        400,
        'Error: Parameter : Playload within the body does not respect its type.\n'
      )
      .end(done);
  });
});

describe('AllowNull = true / AllowNull = false', () => {
  var server: Application;
  var swaggerFile: any;
  before(() => {
    swaggerFile = require('../swagger-examples/UberAPI.json');
  });

  it('should block request when null value is sent and allowNull is false', (done) => {
    server = createFakeServer(
      new Validator.SwaggerInputsValidator(swaggerFile, {
        allowNull: false,
        onError: errorHandler,
      }).post('/estimates/time')
    );
    request
      .agent(server)
      .post('/v1/estimates/time')
      .set('Content-Type', 'application/json')
      .send({
        time: {
          code: 30,
          message: 'message',
          fields: 'fields',
          optional: null,
        },
      })
      .expect(400, 'Error: Parameter : time does not respect its type.\n')
      .end(done);
  });

  it('should not block request when null value is sent and allowNull is true', (done) => {
    server = createFakeServer(
      new Validator.SwaggerInputsValidator(swaggerFile, {
        allowNull: true,
        onError: errorHandler,
      }).post('/estimates/time')
    );
    request
      .agent(server)
      .post('/v1/estimates/time')
      .set('Content-Type', 'application/json')
      .send({
        time: {
          code: 30,
          message: 'message',
          fields: 'fields',
          optional: null,
        },
      })
      .expect(200, {
        success:
          'If you can enter here, it means that the swagger middleware let you do so',
      })
      .end(done);
  });

  it('should block request when null is set to an array value is sent and allowNull is false', (done) => {
    server = createFakeServer(
      new Validator.SwaggerInputsValidator(swaggerFile, {
        allowNull: false,
        onError: errorHandler,
      }).post('/estimates/time')
    );
    request
      .agent(server)
      .post('/v1/estimates/time')
      .set('Content-Type', 'application/json')
      .send({
        time: {
          code: 30,
          message: 'message',
          fields: 'fields',
          optional: {
            sub_prop1: null,
            sub_prop2: false,
          },
        },
      })
      .expect(400, 'Error: Parameter : time does not respect its type.\n')
      .end(done);
  });

  it('should return an HTTP 400 code when parameter in body contains null value and allowNull = false (no encapsulation))', (done) => {
    server = createFakeServer(
      new Validator.SwaggerInputsValidator(swaggerFile, {
        allowNull: false,
        onError: errorHandler,
      }).post('/orders')
    );
    request
      .agent(server)
      .post('/v1/orders')
      .set('Content-Type', 'application/json')
      .send({ code: null, message: 'ok', fields: 'ok' })
      .expect(
        400,
        'Error: Parameter : Playload within the body does not respect its type.\n'
      )
      .end(done);
  });
});

describe('Handle enum properties', () => {
  var server: Application;
  var swaggerFile: any;
  before(() => {
    swaggerFile = require('../swagger-examples/UberAPI.json');
    server = createFakeServer(
      new Validator.SwaggerInputsValidator(swaggerFile, {
        onError: errorHandler,
      }).get('/history')
    );
  });

  it('should block request if parameter in query does not respected authorized values', (done) => {
    request
      .agent(server)
      .get('/v1/history?offset=10&limit=10&optional=notAllowed')
      .expect(400, 'Error: Parameter : optional has an unauthorized value.\n')
      .end(done);
  });

  it('should allows request if parameter in query respects authorized values', (done) => {
    request
      .agent(server)
      .get('/v1/history?offset=10&limit=10&optional=authorizedValue1')
      .expect(200, {
        success:
          'If you can enter here, it means that the swagger middleware let you do so',
      })
      .end(done);
  });
});

describe('Custom errorHandling', () => {
  var server: Application;
  var swaggerFile: any;
  before(() => {
    swaggerFile = require('../swagger-examples/UberAPI.json');
    var customOnError = (errors: Error[], req: Request, res: Response) => {
      res.status(501).json({ error: 'Custom Error' });
    };
    server = createFakeServer(
      new Validator.SwaggerInputsValidator(swaggerFile, {
        onError: customOnError,
      }).get('/products')
    );
  });

  it('should return an HTTP 501 code when all parameters are missing', (done) => {
    request
      .agent(server)
      .get('/v1/products')
      .expect(501, { error: 'Custom Error' })
      .end(done);
  });

  it('should return an HTTP 501 code when only one parameter is missing 1', (done) => {
    request
      .agent(server)
      .get('/v1/products?longitude=50')
      .expect(501, { error: 'Custom Error' })
      .end(done);
  });

  it('should return an HTTP 501 code when only one parameter is missing 2', (done) => {
    request
      .agent(server)
      .get('/v1/products?latitude=50')
      .expect(501, { error: 'Custom Error' })
      .end(done);
  });
});

describe('strict / no strict mode', () => {
  var serverInStrictMode: Application;
  var serverNotInStrictMode: Application;
  var serverInStrictModeAndWaitingForComplexObject: Application;
  var server: Application;
  var swaggerFile: any;

  before(() => {
    swaggerFile = require('../swagger-examples/UberAPI.json');
    serverInStrictMode = createFakeServer(
      new Validator.SwaggerInputsValidator(swaggerFile, {
        strict: true,
        onError: errorHandler,
      }).get('/products')
    );
    serverNotInStrictMode = createFakeServer(
      new Validator.SwaggerInputsValidator(swaggerFile, {
        strict: false,
        onError: errorHandler,
      }).get('/products')
    );
    serverInStrictModeAndWaitingForComplexObject = createFakeServer(
      new Validator.SwaggerInputsValidator(swaggerFile, {
        strict: true,
        onError: errorHandler,
      }).post('/estimates/time')
    );
  });

  it('should return an HTTP 200 code when extra is provided and strict = false', (done) => {
    request
      .agent(serverNotInStrictMode)
      .get('/v1/products?longitude=50&latitude=50&extraParameter=shouldWork')
      .expect(200, {
        success:
          'If you can enter here, it means that the swagger middleware let you do so',
      })
      .end(done);
  });

  it('should return an HTTP 400 code when extra parameters are provided and strict = true', (done) => {
    request
      .agent(serverInStrictMode)
      .get('/v1/products?longitude=50&latitude=50&extraParameter=shouldNotWork')
      .expect(
        400,
        'Error: Parameter : extraParameter should not be specified.\n'
      )
      .end(done);
  });

  it('should return an HTTP 400 code when extra parameters are provided in body and strict = true', (done) => {
    request
      .agent(serverInStrictModeAndWaitingForComplexObject)
      .post('/v1/estimates/time')
      .set('Content-Type', 'application/json')
      .send({
        time: {
          code: 30,
          message: 'message',
          fields: 'fields',
          extraParameter: 'Should not work',
        },
      })
      .expect(400, 'Error: Parameter : time contains extra values.\n')
      .end(done);
  });

  it('should return an HTTP 400 code when extra parameters are provided in body and strict = true (second level check)', (done) => {
    request
      .agent(serverInStrictModeAndWaitingForComplexObject)
      .post('/v1/estimates/time')
      .set('Content-Type', 'application/json')
      .send({
        time: {
          code: 30,
          message: 'message',
          fields: 'fields',
          optional: {
            sub_prop1: 'normalValue',
            sub_prop2: false,
            extraParameter: 'ShouldNotWork',
          },
        },
      })
      .expect(400, 'Error: Parameter : time contains extra values.\n')
      .end(done);
  });

  it('should return an HTTP 400 code when parameters in body do not respet their type (no encapsulation)', (done) => {
    server = createFakeServer(
      new Validator.SwaggerInputsValidator(swaggerFile, {
        strict: true,
        onError: errorHandler,
      }).post('/orders')
    );
    request
      .agent(server)
      .post('/v1/orders')
      .set('Content-Type', 'application/json')
      .send({
        code: 10,
        message: 'ok',
        fields: 'ok',
        extraParameter: 'ShouldNotWork',
      })
      .expect(
        400,
        'Error: Parameter : Playload wihtin the body contains extra values.\n'
      )
      .end(done);
  });
});

describe('Parameter that are not required', () => {
  var serverInStrictMode: Application;
  var serverNotInStrictMode: Application;
  var server: Application;
  var swaggerFile: any;
  before(() => {
    swaggerFile = require('../swagger-examples/UberAPI.json');
    serverInStrictMode = createFakeServer(
      new Validator.SwaggerInputsValidator(swaggerFile, { strict: true }).get(
        '/products'
      )
    );
    serverNotInStrictMode = createFakeServer(
      new Validator.SwaggerInputsValidator(swaggerFile, { strict: false }).get(
        '/products'
      )
    );
  });

  it('should return an HTTP 200 code when optional parameter is provided in strict mode', (done) => {
    request
      .agent(serverInStrictMode)
      .get(
        '/v1/products?longitude=50&latitude=50&optional=IamOptionalButPresentWithinTheSwaggerFile'
      )
      .expect(200, {
        success:
          'If you can enter here, it means that the swagger middleware let you do so',
      })
      .end(done);
  });

  it('should return an HTTP 200 code when optional parameter is provided not in strict mode', (done) => {
    request
      .agent(serverNotInStrictMode)
      .get(
        '/v1/products?longitude=50&latitude=50&optional=IamOptionalButPresentWithinTheSwaggerFile'
      )
      .expect(200, {
        success:
          'If you can enter here, it means that the swagger middleware let you do so',
      })
      .end(done);
  });

  it('should return an HTTP 200 code when optional parameter is not provided in strict mode', (done) => {
    request
      .agent(serverInStrictMode)
      .get('/v1/products?longitude=50&latitude=50')
      .expect(200, {
        success:
          'If you can enter here, it means that the swagger middleware let you do so',
      })
      .end(done);
  });

  it('should return an HTTP 200 code when optional parameter is not provided not in strict mode', (done) => {
    request
      .agent(serverNotInStrictMode)
      .get('/v1/products?longitude=50&latitude=50')
      .expect(200, {
        success:
          'If you can enter here, it means that the swagger middleware let you do so',
      })
      .end(done);
  });

  it('should not block request when complex object is sent within the body without specifying an optional property', (done) => {
    server = createFakeServer(
      new Validator.SwaggerInputsValidator(swaggerFile).post('/estimates/time')
    );
    request
      .agent(server)
      .post('/v1/estimates/time')
      .set('Content-Type', 'application/json')
      .send({ time: { code: 10, message: 'message', fields: 'fields' } })
      .expect(200, {
        success:
          'If you can enter here, it means that the swagger middleware let you do so',
      })
      .end(done);
  });

  it('should return an HTTP 200 code when all parameters in body are provided exept those which are not required (no encapsulation)', (done) => {
    server = createFakeServer(
      new Validator.SwaggerInputsValidator(swaggerFile, { strict: true }).post(
        '/orders'
      )
    );
    request
      .agent(server)
      .post('/v1/orders')
      .set('Content-Type', 'application/json')
      .send({ code: 10, message: 'ok', fields: 'ok' })
      .expect(200, {
        success:
          'If you can enter here, it means that the swagger middleware let you do so',
      })
      .end(done);
  });
});

describe('All parameters provided', () => {
  var server: Application;
  var swaggerFile: any;
  before(() => {
    swaggerFile = require('../swagger-examples/UberAPI.json');
    server = createFakeServer(
      new Validator.SwaggerInputsValidator(swaggerFile).get('/products')
    );
  });

  it('should return an HTTP 200 code when all parameters are provided in query', (done) => {
    request
      .agent(server)
      .get('/v1/products?longitude=50&latitude=50')
      .expect(200, {
        success:
          'If you can enter here, it means that the swagger middleware let you do so',
      })
      .end(done);
  });

  it('should return an HTTP 200 code when one parameter is provided in path', (done) => {
    var app = express();
    app.get(
      '/v1/user/:id',
      new Validator.SwaggerInputsValidator(swaggerFile, { strict: true }).get(
        '/users/:id'
      ),
      function (req, res) {
        res.status(200).json({
          success:
            'If you can enter here, it means that the swagger middleware let you do so',
        });
      }
    );

    request
      .agent(app)
      .get('/v1/user/50')
      .expect(200, {
        success:
          'If you can enter here, it means that the swagger middleware let you do so',
      })
      .end(done);
  });

  it('should return an HTTP 200 code when optional parameter is provided also in query', (done) => {
    request
      .agent(server)
      .get(
        '/v1/products?longitude=50&latitude=50&optional=IamOptionalButPresentWithinTheSwaggerFile'
      )
      .expect(200, {
        success:
          'If you can enter here, it means that the swagger middleware let you do so',
      })
      .end(done);
  });

  it('should return an HTTP 200 code in POST (query + formData) 1', (done) => {
    server = createFakeServer(
      new Validator.SwaggerInputsValidator(swaggerFile).post('/users')
    );
    request
      .agent(server)
      .post('/v1/users?name=Bart&surname=Simpson')
      .set('Content-Type', 'application/json')
      .send({ age: 9, sister: 'Lisa Simpson' })
      .expect(200, {
        success:
          'If you can enter here, it means that the swagger middleware let you do so',
      })
      .end(done);
  });

  it('should return an HTTP 200 code in POST (query + formData) 2', (done) => {
    server = createFakeServer(
      new Validator.SwaggerInputsValidator(swaggerFile, {
        onError: errorHandler,
      }).put('/users')
    );
    request
      .agent(server)
      .put('/v1/users?name=Bart&surname=Simpson')
      .set('Content-Type', 'application/json')
      .send({ age: 9, sister: 'Lisa Simpson' })
      .expect(200, {
        success:
          'If you can enter here, it means that the swagger middleware let you do so',
      })
      .end(done);
  });

  it('should allows empty arrays in body', (done) => {
    server = createFakeServer(
      new Validator.SwaggerInputsValidator(swaggerFile, {
        onError: errorHandler,
      }).post('/estimates/time')
    );
    request
      .agent(server)
      .post('/v1/estimates/time')
      .set('Content-Type', 'application/json')
      .send({
        time: {
          code: 30,
          message: 'message',
          fields: 'fields',
          optionalArray: [],
        },
      })
      .expect(200, {
        success:
          'If you can enter here, it means that the swagger middleware let you do so',
      })
      .end(done);
  });

  it('should allows null values ', (done) => {
    server = createFakeServer(
      new Validator.SwaggerInputsValidator(swaggerFile, {
        allowNull: true,
      }).post('/estimates/time')
    );
    request
      .agent(server)
      .post('/v1/estimates/time')
      .set('Content-Type', 'application/json')
      .send({ time: { code: 30, message: null, fields: 'fields' } })
      .expect(200, {
        success:
          'If you can enter here, it means that the swagger middleware let you do so',
      })
      .end(done);
  });
});

describe('Control all requests', () => {
  var server: Application;
  var swaggerFile: any;
  before(() => {
    swaggerFile = require('../swagger-examples/UberAPI.json');
    var middleware = new Validator.SwaggerInputsValidator(swaggerFile, {
      onError: errorHandler,
    });
    server = createFakeServer(middleware.all());
  });

  it('Should accept the request when path parameter is correct', (done) => {
    request.agent(server).get('/v1/users/50').expect(200).end(done);
  });

  it('Should reject the request when a query parameter is missing', (done) => {
    request.agent(server).get('/v1/products?latitude=50').expect(400).end(done);
  });

  it('Should reject the request when a formData parameter is missing', (done) => {
    request
      .agent(server)
      .post('/v1/users?name=Bart&surname=Simpson')
      .set('Content-Type', 'application/json')
      .send({ age: 9 })
      .expect(400)
      .end(done);
  });

  it('Should return 404 when asking unknown url', (done) => {
    request.agent(server).get('/urlThatDoesNotExist').expect(404).end(done);
  });
});

const createFakeServer = (swaggerMiddleware: RequestHandler): Application => {
  var app = express();

  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(bodyParser.json());
  app.use(swaggerMiddleware);

  app.use((req: Request, res: Response) => {
    if (req.url == '/urlThatDoesNotExist') {
      res.status(404).json({
        success:
          'If you can enter here, it means that the swagger middleware let you do so',
      });
    } else {
      res.status(200).json({
        success:
          'If you can enter here, it means that the swagger middleware let you do so',
      });
    }
  });

  return app;
};

const errorHandler = (
  err: Error[],
  rreq: Request,
  res: Response,
  next: any
) => {
  const error = err.map((x) => `Error: ${x.message}`).join(',') + '\n';

  res.status(400).send(error);
};
