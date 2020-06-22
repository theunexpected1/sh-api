// https://github.com/uxsolutions/bootstrap-datepicker

$(document).ready(function(){
    $('.dateselect').datepicker({
        format: 'mm-dd-yyyy',
        autoclose: true,
        todayHighlight: true
        // startDate: '-3d'
    });
});


// $('.dateselect2').datepicker({
//     format: 'mm/dd/yyyy',
//     autoclose:true,
//     todayHighlidht: true,
// }).on("hide", function(){
//   if ($)
// }

function readURL(input,index) {
    if (input.files && input.files[0]) {
        var reader = new FileReader();
        reader.onload = function (e) {
            $('#imagePreview'+index).css('background-image', 'url(' + e.target.result + ')');
            // $('#imagePreview'+index).attr('src', e.target.result);
            $('#imagePreview'+index).hide();
            $('#imagePreview'+index).fadeIn(650);
        }
        reader.readAsDataURL(input.files[0]);
        // reader.abort();
    }
}

