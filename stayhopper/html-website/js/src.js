//var base_url =  "http://18.222.248.60";
var base_url =  "https://extranet.stayhopper.com";

$.validator.addMethod("alphabetsnspace", function (value, element) {
    return this.optional(element) || /^[a-zA-Z ]*$/.test(value);
});
$.validator.addMethod("alphanumeric", function (value, element) {
    return this.optional(element) || /^[\w.]+$/i.test(value);
}, "Letters, numbers, and underscores only please");
$("#subscribe_form").validate({
    // return false;
    normalizer: function (value) {
        return $.trim(value);
    },
    rules: {
        email_address: {
            required: true,
            email: true
        }
    },
    messages: {
        email_address: {
            required: 'Email address is required',
            email: 'Email must be valid email address'
        }
    },
    submitHandler: function (form) {
        $('.submit-btn').html('Subscribing..');
        $('.info-msg').removeClass('error');
        $('.info-msg').html('');
        $.ajax({
            url: base_url+'/api/website/subscribe',
            data: $(form).serialize(),
            type: 'post',
            dataType: 'json',
            async: false,
            success: function (data) {
                $('.submit-btn').html('Subscribe');
                if (data.status == 1) {
                    $('.info-msg').html(data.message);
                }else{
                    $('.info-msg').addClass('error');
                    $('.info-msg').html(data.message);
                }
                setTimeout(function () {
                    $('.info-msg').html('');
                }, 3000);
            },
            error: function (error) {
                $('.submit-btn').html('Subscribe');
                $('.info-msg').addClass('error');
                $('.info-msg').html('some error occured could not send');
            }
        })
    }
});

//register
$("#register_form").validate({
    normalizer: function (value) {
        return $.trim(value);
    },
    rules: {
        name: {
            required: true,
            alphabetsnspace: true,
            minlength: 3
        },
        email_address: {
            required: true,
            email: true
        },
        phone_number: {
            required: true,
            alphanumeric: true,
        },
        hotel_name: {
            required: true,
        },
        city: {
            required: true,
        },
    },
    messages: {
        name: {
            required: 'Name is required',
            alphabetsnspace: 'Name must have alphabets',
            minlength: 'Name must be minimum 3 characters length'
        },
        email_address: {
            required: 'Email is required',
            email: 'Email must be valid email address'
        },
        phone_number: {
            required: 'Phone is required',
            alphanumeric: 'Phone must have number and characters'
        },
        hotel_name: {
            required: 'Hotel name is requried',
        },
        city: {
            required: 'City is required'
        }
    },
    submitHandler: function (form) {
        $('#regr-btn').html('SENDING...');
        $('.info-msg').html('');
        $.ajax({
            url: base_url+'/api/website/register',
            data: $(form).serialize(),
            type: 'post',
            dataType: 'json',
            async: false,
            success: function (data) {
                $('#regr-btn').html('REQUEST CALLBACK');
                if (data.status == 1) {
                    $('.info-msg').html(data.message);
                    $('#register_form').trigger("reset");
                }
                setTimeout(function () {
                    $('.info-msg').html('');
                    $('#regr-btn').html('REQUEST CALLBACK');
                }, 3000);
            },
            error: function (error) {
                $('#regr-btn').html('REQUEST CALLBACK');
                $('.info-msg').addClass('error');
                $('.info-msg').html('Unable to submit request to server now, try later!');
            }
        })
    }
});
//contact
$("#contact_form").validate({
    normalizer: function (value) {
        return $.trim(value);
    },
    rules: {
        name: {
            required: true,
            alphabetsnspace: true,
            minlength: 3
        },
        email_address: {
            required: true,
            email: true
        },
        phone_number: {
            required: true,
            alphanumeric: true,
        },
        address: {
            required: true,
        },
        message: {
            required: true
        }
    },
    messages: {
        name: {
            required: 'Name is required',
            alphabetsnspace: 'Name must have alphabets',
            minlength: 'Name must be minimum 3 characters length'
        },
        email_address: {
            required: 'Email is required',
            email: 'Email must be valid email address'
        },
        phone_number: {
            required: 'Phone is required',
            alphanumeric: 'Phone must have number and characters'
        },
        address: {
            required: 'Address is requried',
        },
        message: {
            required: 'Message is required'
        }
    },
    submitHandler: function (form) {
        $('#contact-submit-btn').html('SENDING...');
        $('.info-msg').html('');
        $.ajax({
            url: base_url+'/api/website/contact',
            data: $(form).serialize(),
            type: 'post',
            dataType: 'json',
            async: false,
            success: function (data) {
                $('#contact-submit-btn').html('SUBMIT');
                if (data.status == 1) {
                    $('.info-msg').html(data.message);
                    $('#contact_form').trigger("reset");
                }
                setTimeout(function () {
                    $('.info-msg').html('');
                    $('#contact-submit-btn').html('SUBMIT');
                }, 3000);
            },
            error: function (error) {
                $('#contact-submit-btn').html('SUBMIT');
                $('.info-msg').addClass('error');
                $('.info-msg').html('Unable to submit request to server now, try later!');
            }
        })
    }
});