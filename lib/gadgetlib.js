/*
    gadgetlib.js v1.0.2
    Copyright 2014 OmniUpdate, Inc.
    http://www.omniupdate.com/
    
    Changes in 1.0.2:
      - Library now exports gadget object directly to window; no need to use Gadget constructor.
    
    Changes in 1.0.1:
      - Added oucGetCurrentFileInfo method.
*/

(function () {
    
    // private function 
    function getDataFromUrl() {
        /*
            This private function gets certain information from the gadget's URL, including key 
            information you'll need to make an OU Campus API call. These data then become properties of
            the gadget object. The properties are as follows:
            
            Name        Example Value               Description
            ----------- --------------------------- ---------------------------------------------------
            apihost     http://a.cms.omniupdate.com The HTTP root address of the OU Campus application
                                                    server, which is also the API server. All OU Campus 
                                                    API endpoints begin with this value.
            token       A3xthrVCELk8XIaOEQKrIF      The authorization token provided to your gadget
                                                    for the current login session. Must be submitted
                                                    with every API call, in the authorization_token
                                                    parameter.
            gid         ae206856-114c-4124-b0f1     A generated ID that uniquely identifies your
                                                    gadget. This is used by the `fetch` and
                                                    `save` methods.
            place       sidebar                     Lets you know where in the OU Campus user interface 
                                                    the current instance of your gadget is. This can be
                                                    either 'dashboard' or 'sidebar'.
            skin        testdrives                  The name of the current OU Campus skin.
            account     Gallena_University          The name of the OU Campus account to which the 
                                                    user is logged in.
            site        School_of_Medicine          The name of the site that is currently active in
                                                    OU Campus.
            user        jdoe                        The username of the logged-in OU Campus user.
            hostbase    /10/#skin/account/site      The starting fragment of all paths of pages in
                                                    the current OU Campus session. Use this to help
                                                    construct URLs to OU Campus pages that your
                                                    gadget can link to or load in the top window.
            
            So, for example, to get the apihost and token values, you would use:
            
                var apihost = gadget.get('apihost');
                var token = gadget.get('token');
        */
        var data = {};
        var split = location.href.split(/[\?&]/);
        var paramArray = split.splice(1);
        data.url = split[0];
        for (var pieces, left, right, i = 0; i < paramArray.length; i++) {
            pieces = paramArray[i].split('=');
            left = pieces[0];
            right = pieces[1];
            data[left] = right;
        };
        return data;
    }
    // private function 
    function sendMessageToTop(name, payload) {
        var self = gadget;
        var deferred = null;
        var msgid = Math.random().toString().slice(2);
        var message = {
            name     : name, 
            gid      : self.gid,
            origin   : self.url,
            token    : self.token,
            place    : self.place,
            payload  : payload,
            callback : msgid
        };
        deferred = new $.Deferred();
        var _messageHandler = function (evt) {
            if (evt.origin != self.msghost) {
                return;
            }
            var message = evt.data;
            console.log('Response from OU Campus:', message);
            if (message.callback == msgid) {
                window.removeEventListener('message', _messageHandler, false);
                deferred.resolve(message.payload);
            }
        };
        window.addEventListener('message', _messageHandler, false);
        window.top.postMessage(message, self.msghost);
        return deferred;
    }
    // private function 
    function messageHandler(evt) {
        var self = gadget;
        
        if (evt.origin != self.msghost) {
            return;
        }
        var message = evt.data;
        if (message.callback) {
            // the message listener in sendMessageToTop will handle this message
            return;
        }
        console.log('Message from OU Campus:', message);
        if (message.name == 'configuration') {
            self.setConfig(message.payload);
        }
        $(self).trigger(message.name, message.payload);
    }
    
    // the gadget object definition; contains the public methods available to use in your gadget
    // as methods of the `gadget` object
    var gadget = {
        get: function (propName) {
            // Get the value of a property of the gadget.
            if (typeof this[propName] == 'object') {
                return JSON.parse(JSON.stringify(this[propName]));
            } else {
                return this[propName];
            }
        },
        set: function (arg0, arg1) {
            // Set a property of the gadget. You can pass either a single property name and value
            // as two arguments, e.g.:
            //     gadget.set('favoriteColor', 'blue');
            // or several properties in a plain object, e.g.:
            //     gadget.set({ favoriteColor: 'blue', favoriteFlavor: 'vanilla' });
            if (typeof arg0 == 'string') {
                // assume arg0 is a property name and arg1 is the property value
                this[arg0] = arg1;
            } else {
                // assume arg0 is an object
                for (var key in arg0) {
                    if (arg0.hasOwnProperty(key)) {
                        this[key] = arg0[key];
                    }
                }
            }
        },
        getConfig: function (propName) {
            // Same as the `get` method, but returns a subproperty of the gadget's `config`
            // property, which is set by the `fetch` method.
            if (typeof this.config[propName] == 'object') {
                return JSON.parse(JSON.stringify(this.config[propName]));
            } else {
                return this.config[propName];
            }
        },
        setConfig: function (arg0, arg1) {
            // Same as the `set` method, but sets a subproperty of the gadget's `config` property.
            if (typeof arg0 == 'string') {
                // assume arg0 is a property name and arg1 is the property value
                this.config[arg0] = arg1;
            } else {
                // assume arg0 is an object
                for (var key in arg0) {
                    if (arg0.hasOwnProperty(key)) {
                        this.config[key] = arg0[key];
                    }
                }
            }
        },
        fetch: function () {
            // A convenience method to get the gadget's configuration as stored in the OU Campus database
            // by calling the /gadgets/view API. On a successful API call, the method saves the
            // config into the Gadget instance; you can then use `getConfig` to get specific
            // properties of the configuration.
            //
            // The method returns a jQuery Deferred object, so you can use methods like `then` to
            // do stuff once the API call has received a response.
            var self = this;
            var endpoint = self.apihost + '/gadgets/view';
            var params = {
                authorization_token: self.token,
                account: self.account,
                gadget: self.gid
            };
            return $.ajax({
                type    : 'GET',
                url     : endpoint, 
                data    : params, 
                success : function (data) {
                    // console.log('Fetched data:', data);
                    self.config = {};
                    for (var key in data.config) {
                        if (data.config.hasOwnProperty(key)) {
                            self.config[key] = data.config[key].value;
                        }
                    }
                },
                error : function (xhr, status, error) {
                    console.log('Fetch error:', status, error);
                }
            });
        },
        save: function (arg0, arg1) {
            // A convenience method to set one or more properties of the gadget's configuration
            // back to the OU Campus database by calling /gadgets/configure.
            //
            // The method returns a jQuery Deferred object, so you can use methods like `then`
            // to do stuff once the API call has received a response.
            if (arg0) {
                this.setConfig(arg0, arg1);
            }
            var self = this;
            var endpoint = self.apihost + '/gadgets/configure';
            var params = self.config;
            params.authorization_token = self.token;
            params.account = self.account;
            params.gadget = self.gid;
            return $.ajax({
                type    : 'POST',
                url     : endpoint, 
                data    : params, 
                success : function (data) {
                    // console.log('Saved:', data);
                },
                error : function (xhr, status, error) {
                    console.log('Save error:', status, error);
                }
            });
        },
        // Each of the "ouc" methods below is an asynchronous method that returns a jQuery Deferred
        // object, so you can use methods like `then` to do stuff once the operation is finished.
        oucGetCurrentFileInfo: function () {
            // Causes OU Campus to respond with information about the current file in OU Campus, if the
            // current view is file-specific.
            return sendMessageToTop('get-current-file-info');
        },
        oucInsertAtCursor: function (content) {
            // Causes OU Campus to insert the content at the cursor location in, and only in, a WYSIWYG
            // editor (such as JustEdit) and the source code editor.
            return sendMessageToTop('insert-at-cursor', content);
        },
        oucGetCurrentLocation: function () {
            // Causes OU Campus to respond with the app window's location info.
            return sendMessageToTop('get-location');
        },
        oucSetCurrentLocation: function (route) {
            /*
                Causes OU Campus to set the "route" of the OU Campus application. The route is the portion of
                the app's location that follows the sitename. For example, if the current app URL
                is "http://a.cms.omniupdate.com/10/#oucampus/gallena/art/browse/staging/about"
                then the route is "/browse/staging/about". Changing the route will effectively
                change the current OU Campus view, just as if the user had clicked a link within
                OU Campus.
                
                This method accepts a single string parameter, which is the new route. It should
                start with a slash. After the route has been changed, the method will respond with
                the new location.
            */
            return sendMessageToTop('set-location', route);
        }
    };
    
    gadget.set(getDataFromUrl());
    
    window.addEventListener('message', messageHandler, false);
    
    // make the gadget object available as a global variable
    window.gadget = gadget;
})();
