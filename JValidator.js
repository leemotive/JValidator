(function (factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        module.exports = factory();
    } else if (typeof define === 'function' && (define.amd || define.cmd)) {
        define(['jquery'], factory);
    } else {
        this.JValidator = factory(jQuery);
    }
}).call(typeof window !== "undefined" ? window : this, function ($, undefined) {

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
    var indexOf = Array.prototype.indexOf || function (str) {
            var index = this.length;
            while (index--) {
                if (this[index] === str) {
                    return index;
                }
            }
            return index;
        }

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
        'selectMaxLength': '最多选择{0}个',
        'selectMinLength': '至少选择{0}个',
        'mobile': '请输入11位数有效手机号码',
        'idCard': '请输入有效的身份证号码',
        'length': '输入字符长度须等于{0}',
        'selectLength': '只能选择{0}个',
        'required': '不能为空',
        'sameTo': '两次输入不一致',
        'default': '请正确输入'
    };
    var msgDomTemplate = '<span class="j-error-msg" style="display:none"><i class="j-error-icon"></i><span class="j-error-content"></span></span>';

    function JValidator (options) {
        this.fields = [];
        this.status = JValidatorStatus.ENABLE;
        this.validateInvisibleFields = true;

        options = options || {};
        options.root && (this.root = $(options.root)[0]);
        options.msgDom && (this.msgDom = options.msgDom);
        $.extend(this.msgNameSpace = {}, options.messages);
        options.beforeShowError && (this.beforeShowError = options.beforeShowError);
        options.beforeHideError && (this.beforeHideError = options.beforeHideError);
        options.findMsgDom && (this.findMsgDom = options.findMsgDom);
        options.msgDomTemplate && (this.msgDomTemplate = options.msgDomTemplate);

        this.root && this.scan(this.root, true);
    }

    var ruleCache = {
        values: {},
        get: function (key) {
            return key && this.values[key];
        },
        set: function (key, rule) {
            this.values[key] = rule;
        }
    };

    function parseRule (rule) {
        //rule属性的完整写法 name|param*event:msg|msgPlace:msgDomParent,msgDom
        var name, param, eventType, msg, msgPlace, msgDom;
        var resultRule, ruleCopy;
        if (resultRule = ruleCache.get(rule)) {
            return resultRule;
        }
        ruleCopy = rule.replace(/^(\w+)(\||$)/, function (str, sub) {
            name = sub;
            return '';
        });

        // 直接解析到事件名的正则，参数中也可以带*
        ruleCopy = ruleCopy.replace(/(.*?)(?:\*([a-z]*|:)(?::|$)|$)/, function (str, params, event) {
            param = params ? params.split(',') : [];
            eventType = event;
            return '';
        });
        ruleCopy = ruleCopy.split(':');
        if (ruleCopy[0]) {
            msg = ruleCopy[0].split('|');
            msgPlace = msg[1] && msg[1].split(',');
            msg = msg[0];
        }

        if (ruleCopy[1]) {
            msgDom = ruleCopy[1].split(',');
            msgDom.length === 1 && (msgDom = msgDom[0]);
        }

        resultRule = {
            name:name,
            param:param,
            eventType:eventType,
            msg:msg,
            msgPlace:msgPlace,
            msgDom:msgDom
        };
        ruleCache.set(rule, resultRule);
        return resultRule;
    }

    (function () {
        this.ruleAttrName = 'rule';
        this.scan = function (selector, forceRebuilt) {
            var _this, $root, ruleAttrName, ruleAttrSelector;
            _this = this;
            $root = $(selector);
            ruleAttrName = this.ruleAttrName;
            ruleAttrSelector = '[' + ruleAttrName + ']';

            if (!this.root) {
                this.root = $root[0];
                $root = $root.eq(0);
            }
            $(this.root).addClass('j-validator-root');

            $root.each(function(){
                var $this = $(this),
                    $scanRoot = $this.is(ruleAttrSelector) ? $this : $this.find(ruleAttrSelector);

                if (!_this._isChild($this)) {
                    return;
                }

                $scanRoot.each(function () {
                    var $this, ruleStr, field, ruleArray, fieldMsgDom, index;
                    $this = $(this);

                    index = _this._getField($this, true);
                    if (!forceRebuilt && index > -1) {
                        return;
                    }

                    if (index > -1) {
                        _this.remove($this);
                    }

                    field = new Field(_this, $this);
                    ruleStr = $this.attr(ruleAttrName);

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

                    $.each(ruleArray, function (i, expression) {
                        field.rules.push(new Rule(field, parseRule(expression)));
                    });

                    _this.fields.push(field);
                });

            });
            return this;
        };
        this.remove = function (selector) {
            var _this = this;

            $(selector).each(function (index, field) {
                var $field = $(field);
                if ($field.attr(_this.ruleAttrName) === undefined) {
                    $field.find('[' + _this.ruleAttrName + ']').each(function (i, element) {
                        execute(element);
                    });
                } else {
                    execute(field);
                }
            });

            function execute (ele) {
                var delField, index = _this._getField(ele, true);
                if (index > -1) {
                    delField = _this.fields.splice(index, 1);
                    delField[0] && delField[0].destroy();
                }
            }

        };
        this.destroy = function () {
            var _this = this;
            $.each(_this.fields, function (i, field) {
                field.destroy();
            });
            _this.disableValidator();
        };
        this.validate = function (field, ruleName) {
            if (field) {
                //只校验某一个输入域
                return this._getField(field).validate(ruleName);
            }
            var allPass = true, jqXHRs, firstFailed;
            jqXHRs = [];

            if (!this.isEnable()) {
                return true;
            }
            $.each(this.fields, function (i, field) {
                var valid = field.validate();
                if (valid === false) {
                    firstFailed || (firstFailed = field.$element);
                    allPass = false;
                } else if (isObject(valid)) {
                    jqXHRs.push(valid);
                }
            });

            if (jqXHRs.length > 0) {
                allPass = $.when.apply($, jqXHRs);
            }
            if (firstFailed) {
                if ($(firstFailed).is(':hidden')) {
                    firstFailed = $(firstFailed).closest(':visible');
                }
                $(document).scrollTop($(firstFailed).offset().top - 20);
            }
            return allPass;
        };
        this.addRules = function (rules) {
            var _this, newField, $element;
            _this = this;

            $.each(rules, function (i, ruleOp) {
                $element = $(ruleOp.element);

                if ($element.attr(_this.ruleAttrName) === undefined) {
                    $element.attr(_this.ruleAttrName, '');
                    newField = new Field(_this, $element);
                    _this.fields.push(newField);
                } else {
                    $.each(_this.fields, function (i, field) {
                        if (field.$element[0] == $element[0]) {
                            newField = field;
                            return false;
                        }
                    });
                }
                if (ruleOp.expression) {
                    ruleOp = $.extend(parseRule(ruleOp.expression), {method: ruleOp.method})
                }
                ruleOp.name || (ruleOp.name = nextUid());

                newField.rules.push(new Rule(newField, ruleOp));
            });
        };
        this.wrapSubmit = function (func) {
            var _this = this;
            return function () {
                var dom = this;
                var valid = _this.validate();
                if (!valid) {
                    return valid;
                } else if (isObject(valid)) {
                    return valid.done(function () {
                        if (isAllTrue(slice.call(arguments))){
                            func.call(dom);
                        }
                    });
                } else {
                    return func.call(dom);
                }

            };

            function isAllTrue (res) {
                var allTrue = true;
                $.each(res, function (i, v) {
                    if (v.result === false) {
                        allTrue = false;
                        return allTrue;
                    }
                });
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
            var _this = this;
            $(selector).each(function (index, field) {
                var $field = $(field);
                if ($field.attr(_this.ruleAttrName) === undefined) {
                    $field.find('[' + _this.ruleAttrName + ']').each(function (i, element) {
                        _this._getField(element).ignore();
                    });
                } else {
                    _this._getField(field).ignore();
                }
            });
        };
        this.trackFields = function (selector) {
            var _this = this;
            $(selector).each(function (index, field) {
                var $field = $(field);
                if ($field.attr(_this.ruleAttrName) === undefined) {
                    $field.find('[' + _this.ruleAttrName + ']').each(function (i, element) {
                        _this._getField(element).track();
                    });
                } else {
                    _this._getField(field).track();
                }
            });
        };
        this.ignoreInvisibleFields = function () {
            this.validateInvisibleFields = false;
        };
        this.trackInvisibleFields = function () {
            this.validateInvisibleFields = true;
        };
        this.beforeShowError = function () {};
        this.beforeHideError =function () {};
        this._getField = function (ele, _returnIndex) {
            var result = null;
            $.each(this.fields, function (i, field) {
                if (field.$element[0] === $(ele)[0]) {
                    result = _returnIndex ? i : field;
                    return false;
                }
            })
            return _returnIndex && result === null ? -1 : result;
        };
        this._isChild = function (child) {
            child = $(child)[0];
            while(child != undefined && child.tagName.toUpperCase() !== "BODY") {
                if (child === this.root) {
                    return true;
                }
                child = child.parentNode;
            }
            return false;
        }
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
        this.ruleAttrName = function (attrName) {
            //用于设置规则名字设置，校验器默认使用'rule'来标记，可以自定义
            this.prototype.ruleAttrName = attrName;
        };
    }).call(JValidator);

    function Field (jValidator, element) {
        this.jValidator = jValidator;
        this.errors = {
            totalError: 0
        };
        this.$element = $(element).eq(0);
        this.rules = [];
        this.allPass = undefined;
        this.msgDom = this.jValidator.msgDom;
        this.status = JValidatorStatus.ENABLE;

        var _this, $element;
        _this = this;
        $element = this.$element;
        $element.off('focus.JValidatorFocus').on('focus.JValidatorFocus', function () {
            _this.hideError();
        });

    }

    (function () {
        this.validate = function (ruleName) {
            var pass, _this = this;
            _this.allPass = true;

            if (!this.needValidate()) {
                return true;
            }

            if (ruleName && !isArray(ruleName)) {
                ruleName = [ruleName]
            }
            $.each(_this.rules, function (i, rule) {
                if (!ruleName || ~indexOf.call(ruleName, rule.name)) {
                    pass = rule.validate(true);

                    if (pass !== true) {
                        _this.allPass = pass;
                        _this.handleValidateResult(rule);
                        return pass !== false;
                    }
                }
            });

            return _this.allPass;
        };
        this.value = function () {
            return this.$element.val();
        };
        this.text = function () {
            return this.$element.text();
        };
        this.ignore = function () {
            this.status = JValidatorStatus.DISABLE;
        };
        this.track = function () {
            this.status = JValidatorStatus.ENABLE;
        };
        this.needValidate = function () {
            return this.status !== JValidatorStatus.DISABLE && this.isValidatorEnable() && (this.jValidator.validateInvisibleFields || this.$element.is(':visible'));
        };
        this.handleValidateResult = function (rule) {
            var pass, ruleName, errors;
            pass = rule.pass;
            ruleName = rule.name;
            errors = this.errors;
            if (pass === true) {
                if (errors[ruleName]) {
                    errors.totalError--;
                }
                delete errors[ruleName];
                if (errors.totalError === 0) {
                    this.lock = false;
                    this.hideError();
                }
            } else if (pass === false){
                if (!errors[ruleName]) {
                    errors[ruleName] = true;
                    errors.totalError++;
                }
                if (!this.lock) {
                    this.lock = true;
                    this.showError(rule);
                }
            }
        };
        this.isValidatorEnable = function () {
            return this.jValidator.isEnable();
        };
        this.showError = function (rule) {
            var $msgDom, $errorContent, message, msgName;
            $msgDom = $(rule.msgDom);
            msgName = rule.msgName || rule.name;


            $errorContent = $msgDom.find('.error-content');
            if (!$errorContent.length) {
                $errorContent = $msgDom;
            }

            message = rule.msg || this.jValidator.msgNameSpace[msgName] || msgNamespace[msgName] || msgNamespace['default'];
            message = message.replace(/\{([\d+|n])\}/g, function (str, sub) {
                if ('n' === sub) {
                    return rule.msgPlace.join(',');
                } else {
                    return rule.msgPlace[sub] || '';
                }
            });
            $errorContent.text(message);
            this.jValidator.beforeShowError(this.$element[0]);
            this.$element.addClass('j-error');
            $msgDom.show();
        };
        this.hideError = function () {
            this.jValidator.beforeHideError(this.$element[0]);
            this.errors = {
                totalError: 0
            };
            this.lock = false;
            this.$element.removeClass('j-error');
            $.each(this.rules, function (i, rule) {
                $(rule.msgDom).hide();
            });
        };
        this.root = function () {
            return this.jValidator.root;
        };
        this.isCheckbox = function (returnName) {
            var name, $element;
            $element = this.$element;
            name = $element.is(':checkbox');
            if (name && returnName) {
                name = $element.attr('name');
            }
            return name;
        };
        this.isRadio = function (returnName) {
            var name, $element;
            $element = this.$element;
            name = $element.is(':radio');
            if (name && returnName) {
                name = $element.attr('name');
            }
            return name;
        };
        this.destroy = function () {
            this.$element.off('.JValidator');
            delete this.$element;
        };
    }).call(Field.prototype);

    function Rule (field, options) {
        var _this = this, _msgDom;

        this.field = field;
        this.name = options.name;
        this.param = options.param || [];
        this.eventType = options.eventType || 'blur';
        this.msg = options.msg || this.field.msg;
        this.msgPlace = (options.msgPlace || []).concat(this.param);
        this.method = options.method;

        if ((this.name === 'length' || this.name === 'minLength' || this.name === 'maxLength') && this.field.isCheckbox()) {
            this.msgName = 'select' + capitalizeFirstLetter(this.name);
        }

        var $element, msgDomParent;
        $element = this.field.$element;
        _msgDom = options.msgDom || this.field.msgDom || this.field.jValidator.msgDom || ['^', '.j-error-msg'];
        if (isArray(_msgDom)) {
            if (_msgDom[0] === '^') {
                msgDomParent = $element.parent();
            } else if (_msgDom[0].charAt(0) === '^'){
                msgDomParent = $element.closest(_msgDom[0].substring(1));
            } else {
                msgDomParent = $(_msgDom[0]);
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
            var elementId = this.field.$element.attr('id');
            if (!elementId) {
                elementId = nextUid();
                this.field.$element.attr('id', elementId);
            }
            this.msgDom.attr('for', elementId);
        }

        this.pass = undefined;
        this.isRemote = null;
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
        this.validate = function (isSubmit) {
            var _this;
            _this = this;

            if (!this.isFieldNeedValidate()) {
                return true;
            }
            if (isSubmit && _this.eventType !== 'submit' && _this.isRemote) {
                return _this.pass;
            }

            if (_this.pass && isObject(_this.pass)){
                _this.pass.abort();
            }
            if (isFunction(_this.method)) {
                _this.pass = _this.method();
            } else {
                _this.pass = Method[_this.name].call(_this);
            }

            if (!isBoolean(_this.pass)) {
                _this.isRemote = true;
                _this.pass.done(function (data, textStatus, jqXHR) {
                    _this.pass = data.result;
                    _this.msg = data.message || _this.msg;
                    _this.field.handleValidateResult(_this);
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
        this.isFieldNeedValidate = function () {
            return this.field.needValidate();
        };
        this.isValidatorEnable = function () {
            return this.field.jValidator.isEnable();
        };
        this.root = function () {
            return $(this.field.root());
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
        },
        remote: function () {
            return $.ajax({
                url: this.param[0],
                data: {
                    value: this.value()
                },
                dataType: this.param[1] || 'json'
            });
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

    function capitalizeFirstLetter (str) {
        return str && (str.substring(0,1).toUpperCase() + str.substring(1));
    }

    $(function () {
        $('[j-validate]').each(function () {
            var root = this, $this = $(this), validator;
            validator = new JValidator({root: root});
            $this.data('jValidator', validator);
            if ($this.is('form')) {
                $this.on('submit', function () {
                    return validator.validate();
                });
            }
        })
    })


    return JValidator;
});