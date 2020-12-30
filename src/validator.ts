import { Response, Request, RequestHandler, NextFunction } from 'express';

export interface OnError {
  (errors: Error[], req: Request, res: Response, next?: NextFunction): void;
}

export interface Options {
  allowNull?: boolean;
  onError?: OnError | null;
  strict?: boolean;
}

interface PathParamaters {
  [key: string]: any;
}

interface ParsingParameters {
  regexp: string;
  variables: string[];
  swaggerUrl: string;
}

interface WhereToSearch {
  [key: string]: any;
  properties: {
    [key: string]: any;
  };
}

export class SwaggerInputsValidator {
  private _swaggerFile;
  private _basePath;
  private _onError?: OnError | null;
  private _strict;
  private _allowNull = true;
  private _parsingParameters: ParsingParameters[];
  private _models = new Array();

  private static defaultOptions = {
    allowNull: true,
    onError: null,
    strict: false,
  };

  /**
  Constructor
  @param swagger : the swaggerfile in json format
  @param options : [optional] options of the middleware
  */
  constructor(swagger: any, options?: Options) {
    if (swagger || typeof swagger == 'object') {
      //controls that swagger file has at least paths defined
      if (swagger.paths) {
        this._swaggerFile = swagger;
        this._basePath = this._swaggerFile.basePath || '';
        if (options && typeof options != 'object') {
          throw new Error('The parameter option in not an object');
        } else {
          if (options) {
            var onError = options.onError;
            var strict = options.strict;
            var allowNull = options.allowNull;
            if (onError && typeof onError != 'function') {
              throw new Error('The parameter onError in not a function');
            } else {
              this._onError = onError;
            }

            if (strict && typeof strict != 'boolean') {
              throw new Error('The parameter strict in not a boolean');
            } else {
              this._strict = strict ? true : false;
            }

            if (allowNull && typeof allowNull != 'boolean') {
              throw new Error('The parameter allowNull in not a boolean');
            } else {
              this._allowNull = allowNull ? true : false;
            }
          }

          //Now we create an array of regular expressions that we are going to check whenever a request is coming to the app.
          this._parsingParameters = new Array();
          var thisReference = this;
          Object.keys(swagger.paths).forEach(function (url) {
            var variableNames = new Array();
            var customRegex = url.replace(
              /{(\w+)}/gi,
              function myFunction(wholeString, variableName) {
                variableNames.push(variableName);
                return '(\\w+)';
              }
            );
            thisReference._parsingParameters.push({
              regexp: customRegex,
              variables: variableNames,
              swaggerUrl: url,
            });
          });
          //End creation array of regular expression

          //We need now to parse all the models
          Object.keys(swagger.definitions).forEach(function (model) {
            thisReference._models.push(model);
          });
          //End parse all the models
        }
      } else {
        throw new Error(
          'The swagger specified is not correct. It do not contains any paths specification'
        );
      }
    } else {
      throw new Error('Please provide a Swagger file in json format');
    }
  }

  /**
    Private method
    This method is executed if you have specified a custom error method within the constructor of the middleware
    @param erros : Contains all the parameters that do not respect the swagger file requirements
    @param req : the request
    @param res : the response
  */
  private onError = (errors: Error[], req: Request, res: Response) => {
    if (this._onError) {
      this._onError(errors, req, res);
    }
  };

  /**
    Private method
    @param url : the url of the request
    @param parsingParameters : eg : {regexp : "/users/(\w+)", variables: ["id"], swaggerUrl : "/users/{id}"}
    By giving in input the url of the request and the parsingParameters this method is able to extract
    from the url the values of the variable. The aims is to do the same job as express does when you write
    app.get('/users/:id', function(req, res){})
    The :id value is filled within the variable req.params.
    This method do the same thing.
    Why are we not using the express method ?
    Because the method getPathParametersFromUrl is called before express can generate req.params.
    @return the an object that is similar to req.params
  */
  private getPathParametersFromUrl = (
    url: string,
    parsingParameters: ParsingParameters
  ): PathParamaters => {
    var pathParameters: PathParamaters = {};

    if (url !== null) {
      for (var variable of parsingParameters.variables) {
        const match = url.match(parsingParameters.regexp);
        pathParameters[variable] = match?.[1];
      }
    }

    return pathParameters;
  };

  /**
    Private method
    @param url : url of the request
    It fetchs the array this._parsingParameters and performs a test with the regexp in it against the url passed in parameter
    @return eg : {regexp : "/users/(\w+)", variables: ["id"], swaggerUrl : "/users/{id}"}
  */
  private getParsingParameters = (url: string): ParsingParameters | null => {
    var swaggerPath = null;

    for (var i = 0; i < this._parsingParameters.length; i++) {
      var regularExpression = this._parsingParameters[i].regexp;
      var match = url.match(
        new RegExp(this._basePath + regularExpression + '/?(\\?[^/]+)?$', 'gmi')
      );
      if (match) {
        if (swaggerPath) {
          //If we enter here it means that we detected duplicated entries for the regular expression. It means that the regular expression for url parsing must be reviewed.
          throw new Error(
            'Duplicate swagger path for this url. Please signal this bug.'
          );
        } else {
          return this._parsingParameters[i];
        }
      }
    }

    return null;
  };

  /**
    private method
    @param swaggerParameters : the swagger parameter that you have to respect (given a certain url)
    @param queryParameters : the parameters present within the req.query
    @param pathParameters : the parameters present within the req.path
    @param bodyParameters : the parameters present within the req.body
    @return An array of parameters that do not respect the swagger file requirements
  */
  private getErrors = (
    swaggerParameters: any,
    queryParameters: any,
    pathParameters: PathParamaters,
    bodyParameters: any
  ): Error[] => {
    var thisReference = this;

    var errorsToReturn = new Array();
    //We verify that each required parameter within the swagger file is present within the request
    for (var parameter of swaggerParameters) {
      switch (parameter.in) {
        case 'query':
          if (
            queryParameters[parameter.name] === undefined &&
            parameter.required === true
          ) {
            errorsToReturn.push(
              new Error('Parameter : ' + parameter.name + ' is not specified.')
            );
          } else {
            //We now control the type. In query mode, types can only be simple types :
            //"string", "number", "integer", "boolean", "array"
            if (
              queryParameters[parameter.name] &&
              !thisReference.simpleTypeChecking(
                queryParameters[parameter.name],
                parameter
              )
            ) {
              errorsToReturn.push(
                new Error(
                  'Parameter : ' +
                    parameter.name +
                    " does not respect its type (or if an array, at least one element doesn't respect the item type)."
                )
              );
            }
            //We control now the authorized values present within enum
            if (
              parameter.enum &&
              parameter.enum.indexOf(queryParameters[parameter.name]) === -1
            ) {
              // Ignore empty non-mandatory params
              if (
                queryParameters[parameter.name] ||
                parameter.required === true
              ) {
                errorsToReturn.push(
                  new Error(
                    'Parameter : ' +
                      parameter.name +
                      ' has an unauthorized value.'
                  )
                );
              }
            }
          }
          break;
        case 'path':
          if (
            pathParameters[parameter.name] == undefined &&
            parameter.required == true
          ) {
            errorsToReturn.push(
              new Error('Parameter : ' + parameter.name + ' is not specified.')
            );
          } else {
            //We now control the type. In path mode, types can only be simple types : "string", "number", "integer", "boolean", "array"
            if (
              pathParameters[parameter.name] &&
              !thisReference.simpleTypeChecking(
                pathParameters[parameter.name],
                parameter
              )
            ) {
              errorsToReturn.push(
                new Error(
                  'Parameter : ' +
                    parameter.name +
                    ' does not respect its type.'
                )
              );
            }
            //We control now the authorized values present within enum
            if (
              parameter.enum &&
              parameter.enum.indexOf(pathParameters[parameter.name]) == -1
            ) {
              errorsToReturn.push(
                new Error(
                  'Parameter : ' +
                    parameter.name +
                    ' has an unauthorized value.'
                )
              );
            }
          }
          break;
        case 'body':
          //According to the swagger specification, I should enter here only once.
          //In fact a body parameter can be specified only once for one end-point.

          //We check first if parameter.name !== "" because if it is the case it means that the variables are passed directly
          //within the body (no encapsulation) and we then need to check its integrity below with complexTypeChecking
          if (
            parameter.name !== '' &&
            bodyParameters[parameter.name] === undefined &&
            parameter.required == true
          ) {
            errorsToReturn.push(
              new Error('Parameter : ' + parameter.name + ' is not specified.')
            );
          } else {
            //If the parameter name is ""it means that the object will not be encapsuled and will be sent directly within the body playload
            //We now control the type. In body mode, types are complex
            var paramsToCheck =
              parameter.name == ''
                ? bodyParameters
                : bodyParameters[parameter.name];
            if (
              !thisReference.complexTypeChecking(
                paramsToCheck,
                parameter.schema
              )
            ) {
              if (parameter.name != '') {
                errorsToReturn.push(
                  new Error(
                    'Parameter : ' +
                      parameter.name +
                      ' does not respect its type.'
                  )
                );
              } else {
                errorsToReturn.push(
                  new Error(
                    'Parameter : Playload within the body does not respect its type.'
                  )
                );
              }
            }
          }
          break;
        case 'formData':
          if (
            bodyParameters[parameter.name] == undefined &&
            parameter.required == true
          ) {
            errorsToReturn.push(
              new Error('Parameter : ' + parameter.name + ' is not specified.')
            );
          } else {
            //We now control the type. In formData mode, types are not complex
            if (
              bodyParameters[parameter.name] &&
              !thisReference.simpleTypeChecking(
                bodyParameters[parameter.name],
                parameter
              )
            ) {
              errorsToReturn.push(
                new Error(
                  'Parameter : ' +
                    parameter.name +
                    ' does not respect its type.'
                )
              );
            }
            //We control now the authorized values present within enum
            if (
              parameter.enum &&
              parameter.enum.indexOf(bodyParameters[parameter.name]) == -1
            ) {
              errorsToReturn.push(
                new Error(
                  'Parameter : ' +
                    parameter.name +
                    ' has an unauthorized value.'
                )
              );
            }
          }
          break;
      }
    }

    //If the _strict parameter is specified, we do the verification the other way around also.
    //We verify that each parameter in the request is present within the swagger file
    if (this._strict) {
      var isPresentWithinTheSwagger = (
        whereToSearch: string,
        variableName: string
      ) => {
        for (var parameter of swaggerParameters) {
          if (parameter.in == whereToSearch && parameter.name == variableName) {
            return true;
          }
        }
        return false;
      };

      var isThereVariablesThatShouldNotBeSpecified = (
        bodyParameters: any,
        whereToSearch: WhereToSearch
      ) => {
        if (whereToSearch['$ref']) {
          whereToSearch = this.getObjectFromSwaggerReference(
            whereToSearch['$ref']
          );
        }
        var variableToReturn = false;
        var thisReference = this;
        Object.keys(bodyParameters).forEach(function (variableName) {
          if (
            typeof bodyParameters[variableName] == 'object' &&
            Object.prototype.toString.call(bodyParameters[variableName]) !=
              '[object Array]'
          ) {
            variableToReturn =
              variableToReturn ||
              isThereVariablesThatShouldNotBeSpecified.call(
                thisReference,
                bodyParameters[variableName],
                whereToSearch.properties[variableName]
              );
          } else {
            if (whereToSearch.properties[variableName] === undefined) {
              variableToReturn = true;
            }
          }
        });

        return variableToReturn;
      };

      Object.keys(queryParameters).forEach(function (variableName, index) {
        if (!isPresentWithinTheSwagger('query', variableName)) {
          errorsToReturn.push(
            new Error(
              'Parameter : ' + variableName + ' should not be specified.'
            )
          );
        }
      });

      Object.keys(pathParameters).forEach(function (variableName, index) {
        if (!isPresentWithinTheSwagger('path', variableName)) {
          errorsToReturn.push(
            new Error(
              'Parameter : ' + variableName + ' should not be specified.'
            )
          );
        }
      });

      //If the parameters are sent directly within the body (not as form)
      if (swaggerParameters.length == 1 && swaggerParameters[0].in == 'body') {
        //We do a complex check
        var paramsToCheck =
          swaggerParameters[0].name == ''
            ? bodyParameters
            : bodyParameters[swaggerParameters[0].name];
        if (
          isThereVariablesThatShouldNotBeSpecified.call(
            this,
            paramsToCheck,
            swaggerParameters[0].schema
          )
        ) {
          if (swaggerParameters[0].name === '') {
            errorsToReturn.push(
              new Error(
                'Parameter : Playload wihtin the body contains extra values.'
              )
            );
          } else {
            errorsToReturn.push(
              new Error(
                'Parameter : ' +
                  swaggerParameters[0].name +
                  ' contains extra values.'
              )
            );
          }
        }
      } else {
        //Simple check as the others
        Object.keys(bodyParameters).forEach(function (variableName, index) {
          if (!isPresentWithinTheSwagger('formData', variableName)) {
            errorsToReturn.push(
              new Error(
                'Parameter : ' + variableName + ' should not be specified.'
              )
            );
          }
        });
      }
    }
    return errorsToReturn;
  };

  /**
    Private method
    ToDo verify this method.
    @param swaggerReference, a reference to a swagger object ==> "$rel" : "#/definitions/myModel"
    @return the desired model
  */
  private getObjectFromSwaggerReference = (swaggerReference: any) => {
    swaggerReference = swaggerReference.replace('#', '');
    var pathToDigInto = swaggerReference.split('/');
    var objectToReturn = this._swaggerFile;
    for (var i = 1; i < pathToDigInto.length; i++) {
      objectToReturn = objectToReturn[pathToDigInto[i]];
    }
    return objectToReturn;
  };

  /**
    Private method
    @param objectToControl is an object coming from req.body
    @param swaggerModel from which we have to perform the controls
    @return true/false
  */
  private complexTypeChecking = (
    objectToControl: any,
    swaggerModel: any
  ): boolean => {
    //Check if null values are allowed
    if (objectToControl === null) {
      return this._allowNull;
    }

    if (swaggerModel['$ref']) {
      swaggerModel = this.getObjectFromSwaggerReference(swaggerModel['$ref']);
    }

    var thisReference = this;

    switch (swaggerModel.type) {
      case 'object':
        var objectIsCompliant = true;
        Object.keys(swaggerModel.properties).forEach(function (variableName) {
          if (
            (swaggerModel.required &&
              swaggerModel.required.indexOf(variableName) != -1) ||
            objectToControl[variableName] !== undefined
          ) {
            objectIsCompliant =
              objectIsCompliant &&
              thisReference.complexTypeChecking(
                objectToControl[variableName],
                swaggerModel.properties[variableName]
              );
          }
        });
        return objectIsCompliant;

      case 'array':
        if (
          Object.prototype.toString.call(objectToControl) != '[object Array]'
        ) {
          return false;
        }
        var objectIsCompliant = true;
        for (var i = 0; i < objectToControl.length; i++) {
          objectIsCompliant =
            objectIsCompliant &&
            thisReference.complexTypeChecking(
              objectToControl[i],
              swaggerModel.items
            );
        }
        return objectIsCompliant;

      case 'integer':
        return typeof objectToControl == 'number' && objectToControl % 1 == 0;

      default:
        return typeof objectToControl == swaggerModel.type;
    }
  };

  /**
    Private method
    @param parameterToControl : parameter sent by the user and that has to be controled against the swagger specification
    @param typeToEnforce : the swagger type to control
    The parameter that has been sent is string typed. (because coming from path or query or header)
    @return true / false
  */
  private simpleTypeChecking = (
    parameterToControl: any,
    swaggerParameter: any
  ) => {
    var filterInt = function (value: string) {
      if (/^(\-|\+)?([0-9]+|Infinity)$/.test(value)) return Number(value);
      return NaN;
    };

    var filterFloat = function (value: string) {
      if (/^(\-|\+)?([0-9]+(\.[0-9]+)?|Infinity)$/.test(value))
        return Number(value);
      return NaN;
    };

    var isPrimitive = function (test: any) {
      return test !== Object(test);
    };

    //The parameter is specified either in query / path / header or formData
    //Therefor it means that the incoming parameter is a for sure a string but me have to check anyway its type
    //let's check first its type
    switch (swaggerParameter.type) {
      case 'integer':
        //ToDo check format, min, max
        return !isNaN(filterInt(parameterToControl));

      case 'number':
        //ToDo check format, min, max
        if (
          swaggerParameter.format === 'double' ||
          swaggerParameter.format === 'float'
        ) {
          return !isNaN(filterFloat(parameterToControl));
        }
        return !isNaN(filterInt(parameterToControl));

      case 'boolean':
        return parameterToControl === 'true' || parameterToControl === 'false';

      case 'array':
        if (
          Object.prototype.toString.call(parameterToControl) !==
          '[object Array]'
        )
          return false;

        parameterToControl.forEach((x: any) => {
          if (!isPrimitive(x)) {
            return false;
          }
        });

        return true;

      case 'string':
        return (
          Object.prototype.toString.call(parameterToControl) ===
          '[object String]'
        );
    }
  };

  /**
    Private method
    @param : verb (GET, POST, PUT, DELETE etc...)
    @param : swagger url of the request
    Look for the required parameters I have to respect depending on the requested url
    @return the required parameters I have to respect
  */
  private getRequiredParameters = (verb: string, url: string) => {
    url = url.replace(/:(\w+)/gi, function myFunction(x: string, y: string) {
      return '{' + y + '}';
    });
    verb = verb.toLowerCase();

    //If parameter is undefined is because the user asked for an url which is not present within the swagger file
    if (
      this._swaggerFile.paths[url] == undefined ||
      this._swaggerFile.paths[url][verb] == undefined
    ) {
      throw new Error(
        'Their is no swagger entries for the url : ' +
          url +
          'with the HTTP verb : ' +
          verb
      );
      return [];
    }

    var parameters = this._swaggerFile.paths[url][verb].parameters;

    if (parameters == undefined) {
      parameters = [];
    }

    return parameters;
  };

  /**
    Private method
    @param swaggerParamters : required parameters for the request
    @return a generique middleware that will control that all the requested parameters are present within the request
  */
  private getGeneriqueMiddleware = (swaggerParameters: any): RequestHandler => {
    var thisReference = this;
    return function (req: Request, res: Response, next: NextFunction) {
      var queryParameters = req.query;
      var pathParameters = req.params;
      //In get request, the body equals to null, this is why we need to instanciate it to {}
      var bodyParameters = req.body ? req.body : {};

      var errorsToReturn = thisReference.getErrors(
        swaggerParameters,
        queryParameters,
        pathParameters,
        bodyParameters
      );

      if (errorsToReturn.length == 0) {
        next();
      } else {
        res.status(400);
        if (thisReference._onError) {
          //We call the onError private method giving him a context. This is why we are using onError.call
          thisReference.onError(errorsToReturn, req, res);
        } else {
          next(errorsToReturn);
        }
      }
    };
  };

  /**
    @return a middleware that will control all the incoming requests
  */
  public all = (): RequestHandler => {
    var thisReference = this;
    return (req, res, next) => {
      var verb = req.method;
      var url = req.url;
      var parsingParameters = thisReference.getParsingParameters(url);

      //If no parsing parameters are found, is either because their is no swagger path available for the requested url
      //Or the app will return an 404 error code.
      if (parsingParameters == null) {
        next();
        return;
      }

      var swaggerParameters = thisReference.getRequiredParameters(
        verb,
        parsingParameters.swaggerUrl
      );

      var queryParameters = req.query;
      var pathParameters = thisReference.getPathParametersFromUrl(
        url,
        parsingParameters
      );
      //In get request, the body equals to null, this is why we need to instanciate it to {}
      var bodyParameters = req.body ? req.body : {};

      var errorsToReturn = thisReference.getErrors(
        swaggerParameters,
        queryParameters,
        pathParameters,
        bodyParameters
      );

      if (errorsToReturn.length == 0) {
        next();
      } else {
        res.status(400);
        if (thisReference._onError) {
          //We call the onError private method giving him a context. This is why we are using onError.call
          thisReference.onError(errorsToReturn, req, res);
        } else {
          next(errorsToReturn);
        }
      }
    };
  };

  /**
    @param url : url to control
    @return a middleware that will control all the incoming requests in get that respect a given url
  */
  public get = (url: string): RequestHandler => {
    var requiredParameters = this.getRequiredParameters('get', url);
    return this.getGeneriqueMiddleware(requiredParameters);
  };

  /**
    @param url : url to control
    @return a middleware that will control all the incoming requests in post that respect a given url
  */
  public post = (url: string): RequestHandler => {
    var requiredParameters = this.getRequiredParameters('post', url);
    return this.getGeneriqueMiddleware(requiredParameters);
  };

  /**
    @param url : url to control
    @return a middleware that will control all the incoming requests in put that respect a given url
  */
  public put = (url: string): RequestHandler => {
    var requiredParameters = this.getRequiredParameters('put', url);
    return this.getGeneriqueMiddleware(requiredParameters);
  };

  /**
    @param url : url to control
    @return a middleware that will control all the incoming requests in delete that respect a given url
  */
  public delete = (url: string): RequestHandler => {
    var requiredParameters = this.getRequiredParameters('delete', url);
    return this.getGeneriqueMiddleware(requiredParameters);
  };

  /**
    @param url : url to control
    @return a middleware that will control all the incoming requests in patch that respect a given url
  */
  public patch = (url: string): RequestHandler => {
    var requiredParameters = this.getRequiredParameters('patch', url);
    return this.getGeneriqueMiddleware(requiredParameters);
  };

  /**
    @param url : url to control
    @return a middleware that will control all the incoming requests in head that respect a given url
  */
  public head = (url: string): RequestHandler => {
    var requiredParameters = this.getRequiredParameters('head', url);
    return this.getGeneriqueMiddleware(requiredParameters);
  };
}
