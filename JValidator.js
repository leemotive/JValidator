(function (factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        module.exports = factory();
    } else if (typeof define === 'function' && (define.amd || define.cmd)) {
        define(['jquery'], factory);
    } else {
        this.JValidator = factory(jQuery);
    }
}).call(typeof window !== "undefined" ? window : this, function ($) {

    function isType (type) {
        return function (obj) {
            return Object.prototype.toString.call(obj) === '[object ' + type + ']';
        };
    }

    var isFunction = isType('Function');
    var isBoolean = isType('Boolean');
    var isObject = isType('Object');
    var isArray = Array.isArray || isType('Array');
    var slice = Array.prototype.slice;

    var JValidatorStatus = {
        ENABLE: 1,
        DISABLE: 0
    };

    var msgNamespace = {
        'zipCode': '请输入6位数邮政编码',
        'number': '请填写合适的数字',
        'int': '请填写合适的整数',
        'float': '请填写合适的小数',
        'email': '请输入正确的邮件地址',
        'max': '请填写小于或者等于{0}的数',
        'min': '请填写大于或者等于{0}的数',
        'maxLength': '输入字符长度不得大于{0}',
        'minLength': '输入字符长度不得小于{0}',
        'mobile': '请输入11位数有效手机号码',
        'idCard': '请输入有效的身份证号码',
        'length': '输入字符长度须等于{0}',
        'required': '不能为空',
        'sameTo': '两次输入不致'
    };
    var msgDomTemplate = '<span class="j-error-msg" style="display:none"><i class="j-error-icon iconV2 errorIcon"></i><span class="error-content"></span></span>';

    function JValidator (options) {
        options = options || {};
        options.root && (this.root = $(options.root));
        this.fields = [];
        this.status = JValidatorStatus.ENABLE;
        options.msgDom && (this.msgDom = options.msgDom);
        $.extend(this.msgNameSpace = {}, options.messages);
        this.validateInvisibleFileds = true;
        options.beforeShowError && (this.beforeShowError = options.beforeShowError);
        options.beforeHideError && (this.beforeHideError = options.beforeHideError);
        options.findMsgDom && (this.findMsgDom = options.findMsgDom);
        options.msgDomTemplate && (this.msgDomTemplate = options.msgDomTemplate);

        this.root && this.scan(this.root);
    }


    (function () {
        this.scan = function (selector) {
            var _this, $root;
            _this = this;
            $root = $(selector);
            this.root || (this.root = $root );
            $root = $root.is('[rule]') ? $root : $root.find('[rule]');
            $root.each(function(){
                var $this, ruleStr, field, ruleArray, fieldMsgDom;
                $this = $(this);
                field = new Field(_this, $this);
                ruleStr = $this.attr('rule');

                ruleArray = ruleStr.split(/\s+/);
                fieldMsgDom = ruleArray.pop();
                if (fieldMsgDom.charAt(0) === ':') {
                    //如果最后一个是以:始,则是定义这个field上的一些共同的东西msg:msgDom
                    fieldMsgDom = fieldMsgDom.replace(/^:/, '').split(':');
                    field.msg = fieldMsgDom[0];
                    field.msgDom = (fieldMsgDom[1] || '').split(',');
                    field.msgDom.length === 1 && (field.msgDom = field.msgDom[0]);
                } else {
                    ruleArray.push(fieldMsgDom);
                }

                $.each(ruleArray, function (i, rule) {
                    //rule属性的完整写法 name|param*event:msg|msgPlace:msgDomParent,msgDom
                    var name, param, eventType, msg, msgPlace, msgDom;
                    rule = rule.replace(/^(\w+)(\||$)/, function (str, sub) {
                        name = sub;
                        return '';
                    });
                    
                    rule = rule.replace(/([^\*]*)(\*|$)/, function (str, sub) {
                        param = sub ? sub.split(',') : [];
                        return '';
                    });
                    
                    rule = rule.split(':');
                    eventType = rule[0] || 'blur';

                    if (rule[1]) {
                        msg = rule[1].split('|');
                        msgPlace = msg[1];
                        msg = msg[0];
                        if (msgPlace) {
                            msgPlace = msgPlace.split(',');
                        }
                    }

                    if (rule[2]) {
                        msgDom = rule[2].split(',');
                        msgDom.length === 1 && (msgDom = msgDom[0]);
                    }

                    rule = new Rule(field, name, param, eventType, msg, msgPlace, msgDom);
                    field.rules.push(rule);
                });

                _this.fields.push(field);
            });
            return this;
        };
        this.remove = function (selector) {
            var _this = this;
            $(selector).find('[rule]').each(function(){
                var element = this;
                $.each(_this.fields, function (i, field) {
                    if (field.element[0] == element) {
                        field.destroy();
                        _this.fields.splice(i, 1);
                        return false;
                    }
                });
            });
        };
        this.destroy = function () {
            var _this = this;
            $.each(_this.fields, function (i, field) {
                field.destroy();
            });
            _this.disableValidator();
        };
        this.validate = function () {
            var allPass = true, jqXHRs, firstFailed;
            jqXHRs = [];

            if (!this.isEnable()) {
                return true;
            }

            $.each(this.fields, function (i, field) {
                var valid = field.validate();
                if (valid === false) {
                    firstFailed || (firstFailed = field.element);
                    allPass = false;
                } else if (isObject(valid)) {
                    jqXHRs.push(valid);
                }
            });

            if (jqXHRs.length > 0) {
                allPass = $.when.apply($, jqXHRs);
            }
            if (firstFailed) {
                $(document).scrollTop($(firstFailed).offset().top - 20);
            }
            return allPass;
        };
        this.addRules = function (rules) {
            var _this, newField, $element, ruleName, param, eventType, msg, msgPlace, msgDom, method;
            _this = this;

            $.each(rules, function (i, ruleOp) {

                $element = $(ruleOp.element);

                if ($element.attr('rule') === undefined) {
                    $element.attr('rule', '');
                    newField = new Field(_this, $element);
                    _this.fields.push(newField);
                } else {
                    $.each(_this.fields, function (i, field) {
                        if (field.element[0] == ruleOp.element) {
                            newField = field;
                            return false;
                        }
                    });
                }

                ruleName = ruleOp.name || nextUid();
                eventType = ruleOp.eventType || 'submit';
                param = ruleOp.param || [];
                msg = ruleOp.msg || newField.msg || '';
                msgPlace = ruleOp.msgPlace || [];
                msgDom = ruleOp.msgDom || '';
                method = ruleOp.method;

                newField.rules.push(new Rule(newField, ruleName, param, eventType, msg, msgPlace, msgDom, method));
            });
        };
        this.wrapSubmit = function (func) {
            var _this = this;
            return function () {
                var valid = _this.validate();
                if (!valid) {
                    return valid;
                } else if (isObject(valid)) {
                    return valid.done(function () {
                        if (isAllTrue(slice.call(arguments))){
                            func();
                        }
                    });
                } else {
                    return func();
                }
                
            };

            function isAllTrue (res) {
                var allTrue = true;
                if (isObject(res[1])) {
                    $.each(res, function (i, v) {
                        if (v.result === false) {
                            allTrue = false;
                            return allTrue;
                        }
                    });
                } else {
                    allTrue = res[0].result;
                }
                return allTrue;
            }
        };
        this.enableValidator = function () {
            this.status = JValidatorStatus.ENABLE;
        };
        this.disableValidator = function () {
            this.status = JValidatorStatus.DISABLE;
        };
        this.isEnable = function () {
            return !!this.status;
        };
        this.setMessage = function (option) {
            $.extend(this.msgNameSpace, option);
        };
        this.setMsgDomTemplate = function (template) {
            this.msgDomTemplate = template;
        };
        this.ignoreFields = function (selector) {
            var $container = $(selector);
            if ($container.attr('rule') != null) {
                $container.data('jField').ignore();
            } else {
                $container.find('[rule]').each(function (i, element) {
                    $(element).data('jField').ignore();
                });
            }
        };
        this.trackFields = function (selector) {
            var $container = $(selector);
            if ($container.attr('rule') != null) {
                $container.data('jField').track();
            } else {
                $container.find('[rule]').each(function (i, element) {
                    $(element).data('jField').track();
                });
            }
        };
        this.ignoreInvisibleFields = function () {
            this.validateInvisibleFileds = false;
        };
        this.trackInvisibleFields = function () {
            this.validateInvisibleFileds = true;
        };
        this.beforeShowError = function () {};
        this.beforeHideError =function () {};
    }).call(JValidator.prototype);

    (function () {
        this.registerRule = function (name, callback, message, overWrite) {
            if (isObject(name)) {
                overWrite = name.overWrite;
                message = name.message;
                callback = name.callback;
                name = name.name;
            } else {
                if (isBoolean(message)) {
                    overWrite = message;
                    message = '';
                }
            }

            if (Method[name] && !overWrite) {
                throw name + " is exists, can not regist as a rule.";
            }
            Method[name] = callback;
            if (message) {
                msgNamespace[name] = message;
            }
        };
        this.setDefaultMessage = function (option) {
            $.extend(msgNamespace, option);
        };
        this.setMsgDomTemplate = function (template) {
            msgDomTemplate = template;
        };
    }).call(JValidator);

    function Field (jValidator, element) {
        this.jValidator = jValidator;
        this.errors = {
            totalError: 0
        };
        this.element = element;
        this.rules = [];
        this.allPass = undefined;
        this.msgDom = this.jValidator.msgDom;
        this.status = JValidatorStatus.ENABLE;

        var _this, $element;
        _this = this;
        $element = this.element;
        $element.off('focus.JValidatorFocus').on('focus.JValidatorFocus', function () {
            _this.hideError();
        });
        if ($element.is(':checkbox') || $element.is(':radio')) {
            $element.off('click.JValidatorClick').on('click.JValidatorClick', function () {
                _this.hideError();
            });
        }

        $(this.element).data('jField', this);
    }

    (function () {
        this.validate = function () {
            var pass, _this = this;
            _this.allPass = true;

            if (!_this.isValidatorEnable()) {
                return true;
            }

            $.each(_this.rules, function (i, rule) {
                pass = rule.validate();

                if (pass !== true) {
                    _this.allPass = pass;
                    _this.handleValidateResult(rule);
                    if (pass === false) {
                        return false;
                    }
                }
            });

            return _this.allPass;
        };
        this.value = function () {
            return this.element.val();
        };
        this.text = function () {
            return this.element.text();
        };
        this.ignore = function () {
            this.status = JValidatorStatus.DISABLE;
        };
        this.track = function () {
            this.status = JValidatorStatus.ENABLE;
        };
        this.isIgnored = function () {
            return this.status === JValidatorStatus.DISABLE;
        };
        this.handleValidateResult = function (rule, msg) {
            var $element, pass, ruleName, errors;
            $element = this.element;
            pass = rule.pass;
            ruleName = rule.name;
            errors = this.errors;
            if (pass === true) {
                //$element.removeClass('j-error-' + ruleName);
                if (errors[ruleName]) {
                    errors.totalError--;
                }
                delete errors[ruleName];
                if (errors.totalError === 0) {
                    this.lock = false;
                    this.hideError(rule);
                }
            } else if (pass === false){
                //$element.addClass('j-error-' + ruleName);
                if (!errors[ruleName]) {
                    errors[ruleName] = true;
                    errors.totalError++;
                }
                if (!this.lock) {
                    this.lock = true;
                    this.showError(rule, msg);
                }
            }
        };
        this.isValidatorEnable = function () {
            return this.jValidator.isEnable();
        };
        this.showError = function (rule, msg) {
            var $msgDom, errorContent, message, ruleName;
            $msgDom = $(rule.msgDom);
            ruleName = rule.name;
            
            errorContent = $msgDom.find('.error-content');
            if (!errorContent.length) {
                errorContent = $msgDom;
            }

            message = msg || rule.msg || this.jValidator.msgNameSpace[ruleName] || msgNamespace[ruleName] || '请正确输入';
            message = message.replace(/\{([\d+|n])\}/g, function (str, sub) {
                if ('n' === sub) {
                    return rule.msgPlace.join(',');
                } else {
                    return rule.msgPlace[sub] || '';
                }
            });
            errorContent.text(message);
            this.jValidator.beforeShowError(this.element[0]);
            this.element.addClass('j-error');
            $msgDom.show();
        };
        this.hideError = function (rule) {
            this.jValidator.beforeHideError(this.element[0]);
            this.errors = {
                totalError: 0
            };
            this.lock = false;
            this.element.removeClass('j-error');
            this.rules.forEach(function (rule) {
                $(rule.msgDom).hide();
            });
        };
        this.root = function () {
            return this.jValidator.root;
        };
        this.isCheckbox = function (returnName) {
            var name, $element;
            $element = $(this.element);
            name = $element.is(':checkbox');
            if (name && returnName) {
                name = $element.attr('name');
            }
            return name;
        };
        this.isRadio = function (returnName) {
            var name, $element;
            $element = $(this.element);
            name = $element.is(':radio');
            if (name && returnName) {
                name = $element.attr('name');
            }
            return name;
        };
        this.destroy = function () {
            $(this.element).off('.JValidator');
            delete this.element;
        };
    }).call(Field.prototype);

    function Rule (field, name, param, eventType, msg, msgPlace, msgDom, method) {
        var _this = this, _msgDom;

        this.field = field;
        this.name = name;
        this.param = param || [];
        this.eventType = eventType || 'blur';
        this.msg = msg || this.field.msg;
        this.msgPlace = (msgPlace || []).concat(this.param);
        this.method = method;

        var $element, msgDomParent;
        $element = this.field.element;
        _msgDom = msgDom || this.field.msgDom || this.field.jValidator.msgDom || ['^', '.j-error-msg'];
        if (isArray(_msgDom)) {
            if (_msgDom[0] === '^') {
                msgDomParent = $element.parent();
            } else {
                msgDomParent = $element.closest(_msgDom[0]);
            }
            if (_msgDom[1]){
                _msgDom = msgDomParent.find(_msgDom[1]);
            } else {
                _msgDom = msgDomParent.find('.j-error-msg');
            }
            if (!_msgDom.length) {
                if (isFunction(this.field.jValidator.findMsgDom)) {
                    _msgDom = this.field.jValidator.findMsgDom($element);
                } else {
                    _msgDom = $(this.field.jValidator.msgDomTemplate || msgDomTemplate);
                    msgDomParent.append(_msgDom);
                }
            }
        } else {
            _msgDom = $(_msgDom);
        }
        this.msgDom = _msgDom;
        if (this.msgDom.is('label')) {
            var elementId = this.field.element.attr('id');
            if (!elementId) {
                elementId = nextUid();
                this.field.element.attr('id', elementId);
            }
            this.msgDom.attr('for', elementId);
        }

        this.pass = undefined;
        this.xhr = null;
        if (this.eventType != 'submit') {
            if ($element.is('select')){
                this.eventType = 'change blur';
            } else if ($element.is(':checkbox') || $element.is(':radio')) {
                this.eventType = 'click';
            }
            $element.on(this.eventType + '.JValidator', function () {
                _this.validate();
            });
        }
    }

    (function () {
        this.validate = function () {
            var _this, originPass;

            if (this.isFieldIgnored() || !this.isValidatorEnable() || (!this.field.jValidator.validateInvisibleFileds && !this.isFieldVisible())) {
                return true;
            }

            _this = this;
            originPass = _this.pass;
            if (originPass && isObject(originPass)){
                originPass.abort();
            }
            if (isFunction(_this.method)) {
                _this.pass = _this.method();
            } else {
                _this.pass = Method[_this.name].call(_this);
            }

            if (!isBoolean(_this.pass)) {
                _this.pass.done(function (data, textStatus, jqXHR) {
                    _this.pass = data.result;
                    _this.field.handleValidateResult(_this, data.msg);
                });
            }

            _this.field.handleValidateResult(_this);
            return _this.pass;
        };
        this.value = function () {
            return this.field.value();
        };
        this.text = function () {
            return this.field.text();
        };
        this.isFieldIgnored = function () {
            return this.field.isIgnored();
        };
        this.isValidatorEnable = function () {
            return this.field.jValidator.isEnable();
        };
        this.root = function () {
            return this.field.root();
        };
        this.isFieldVisible = function () {
            return this.field.element.is(':visible');
        };
    }).call(Rule.prototype);

    var Method = {
        zipCode: function () {
            var valid, value;
            value = this.value();
            valid = true;
            if (value) {
                valid = /^\d{6}$/.test(value);
            }
            return valid;
        },
        number: function () {
            return Method.int.call(this) || Method.float.call(this);
        },
        int: function () {
            var regExp, valid = true, value = this.value(), sign = this.param[0];
            regExp = sign ? /^\d+$/ : /^[\+|-]?\d+$/;
            value && (valid = regExp.test(value));
            return valid;
        },
        float: function () {
            var regExp, valid = true, value = this.value(), sign = this.param[0];
            regExp = sign ? /^\d+\.\d+$/ : /^[\+|-]?\d+\.\d+$/;
            value && (valid = regExp.test(value));
            return valid;
        },
        email: function () {
            var valid = true, value = this.value();
            value && (valid = /^\w+@\w+\.\w+$/.test(value));
            return valid;
        },
        required: function () {
            var name, valid, value;
            if (name = this.field.isCheckbox(true)) {
                value = this.root().find('[name=' + name+']:checked').length;
                valid = !!value;
            } else if (name = this.field.isRadio(true)) {
                value = this.root().find('[name=' + name+']:checked').length;
                valid = !!value;
            } else {
                valid = !!this.value();
            }
            return valid;
        },
        max: function () {
            var value = this.value();
            if (value === '') {
                return true;
            }
            return Number(value) <= Number(this.param[0]);
        },
        min: function () {
            var value = this.value();
            if (value === '') {
                return true;
            }
            return Number(value) >= Number(this.param[0]);
        },
        maxLength: function () {
            var valid, name, value;
            valid = true;
            name = this.field.isCheckbox(true);
            if (name) {
                value = this.root().find('[name=' + name+']:checked').length;
                value && (valid = value <= this.param[0]);
                this.msg || (this.msg = '最多选择{0}个');
            } else {
                value = String(this.value());
                value && (valid = value.length <= this.param[0]);
            }
            return valid;
        },
        minLength: function () {
            var valid, name, value;
            valid = true;
            name = this.field.isCheckbox(true);
            if (name) {
                value = this.root().find('[name=' + name + ']:checked').length;
                valid = value >= this.param[0];
                this.msg || (this.msg = '至少选择{0}个');
            } else {
                value = String(this.value());
                value && (valid = value.length >= this.param[0]);
            }
            return valid;
        },
        mobile: function () {
            var valid = true, value = String(this.value());
            value && (valid = /^1\d{10}$/.test(value));
            return valid;
        },
        idCard: function () {
            var sum = 0, valid = true, value = String(this.value());
            var year, month, day;
            if (value) {
                if (this.param[0] == 15) {
                    valid = /^\d{15}$/.test(value);
                    if (valid) {
                        return valid;
                    }
                }
                valid = /^\d{17}[\d|x|X]$/.test(value);
                if (valid) {
                    year = Number(value.slice(6, 10));
                    month = Number(value.slice(10, 12));
                    day = Number(value.slice(12, 14));
                    if (month > 12 || month < 1 || day > daysInMonth(month, year)) {
                        valid = false;
                    }
                }
                if (valid) {
                    $.each(value.slice(0, -1).split(''), function (i, v) {
                        sum += Math.pow(2, 17 - i) * v;
                    });

                    sum = Math.abs((sum % 11) - 12) % 11;
                    valid = sum == value.charAt(17) || (value.charAt(17).toUpperCase() == 'X' && sum == 10);
                }
            }
            return valid;
        },
        length: function () {
            var valid, name, value;
            valid = true;
            name = this.field.isCheckbox(true);
            if (name) {
                value = this.root().find('[name=' + name + ']:checked').length;
                value && (valid = value == this.param[0]);
                this.msg || (this.msg = '只能选择{0}个');
            } else {
                value = String(this.value());
                value && (valid = value.length == this.param[0]);
            }
            return valid;

        },
        pattern: function () {
            var valid, value, pattern;
            valid = true;
            value = this.value();
            if (value) {
                pattern = new RegExp(this.param[0], this.param[1]);
                valid = pattern.test(value);
            }
            return valid;
        },
        sameTo: function () {
            var valid, value;
            valid = true;
            value = this.value();
            if (value) {
                valid = value == $(this.param[0]).val();
            }
            return valid;
        }
    };

    var nextUid = (function () {
            var uid = ['0', '0', '0'],
                next,
                prefix = 'jRuleName';

            next = function () {
                var index = uid.length;
                var digit;

                while(index) {
                    index--;
                    digit = uid[index].charCodeAt(0);
                    if (digit == 57 /*'9'*/) {
                        uid[index] = 'a';
                        return prefix + uid.join('');
                    }
                    if (digit == 122  /*'z'*/) {
                        uid[index] = 'A';
                        return prefix + uid.join('');
                    } 

                    if (digit == 90) {
                        uid[index] = '0';
                    } else {
                        uid[index] = String.fromCharCode(digit + 1);
                        return prefix + uid.join('');
                    }
                }
                uid.unshift('0');
                return prefix + uid.join('');
            };
            return next;
        }());

    function isLeapYear(year) {
        return year % 4 === 0 && year % 100 !== 0 || year % 400 === 0;
    }

    function daysInMonth(month, year) {
        if (month === 2) {
            return isLeapYear(year) ? 29 : 28;
        }
        return Math.ceil(Math.abs(month - 7.5)) % 2 + 30;
    }

    return JValidator;
});