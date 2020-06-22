if (/Mobi/.test(navigator.userAgent)) {
  // if mobile device, use native pickers
  // $(".date-time input").attr("type", "datetime-local");
  // $(".date input").attr("type", "date");
  // $(".time input").attr("type", "time");
} else {
  // if desktop device, use DateTimePicker
 
}
// $("#datetimepicker").datetimepicker({
//   icons: {
//     time: "icon-clock",
//     date: "icon-date",
//     up: "icon-back",
//     down: "icon-open",
//     next: "icon-chevron",
//     previous: "icon-left"
//   }
// });
// $("#datepicker").datetimepicker({
//   minDate: moment(),
//   useCurrent: true,
//   format: "L",
//   icons: {
//     next: "icon-chevron",
//     previous: "icon-left"
//   }
// });
$("#datepicker").datepicker({
  format: 'mm/dd/yyyy',
  startDate: '0d'
});

// $("#timepicker").datetimepicker({
//   format: "LT",
//   //      format: 'HH-mm',
//   icons: {
//     up: "icon-back",
//     down: "icon-open"
//   }
// });
////

window.onload = function() {
  crear_select();
};

function isMobileDevice() {
  return (
    typeof window.orientation !== "undefined" ||
    navigator.userAgent.indexOf("IEMobile") !== -1
  );
}

var li = new Array();
function crear_select() {
  var div_cont_select = document.querySelectorAll(
    "[data-mate-select='active']"
  );
  var select_ = "";
  for (var e = 0; e < div_cont_select.length; e++) {
    div_cont_select[e].setAttribute("data-indx-select", e);
    div_cont_select[e].setAttribute("data-selec-open", "false");
    var ul_cont = document.querySelectorAll(
      "[data-indx-select='" + e + "'] > .cont_list_select_mate > ul"
    );
    select_ = document.querySelectorAll(
      "[data-indx-select='" + e + "'] >select"
    )[0];
    if (isMobileDevice()) {
      select_.addEventListener("change", function() {
        _select_option(select_.selectedIndex, e);
      });
    }
    var select_optiones = select_.options;
    document
      .querySelectorAll(
        "[data-indx-select='" + e + "']  > .selecionado_opcion "
      )[0]
      .setAttribute("data-n-select", e);
    document
      .querySelectorAll(
        "[data-indx-select='" + e + "']  > .icon_select_mate "
      )[0]
      .setAttribute("data-n-select", e);
    for (var i = 0; i < select_optiones.length; i++) {
      li[i] = document.createElement("li");
      if (
        select_optiones[i].selected == true ||
        select_.value == select_optiones[i].innerHTML
      ) {
        li[i].className = "active";
        document.querySelector(
          "[data-indx-select='" + e + "']  > .selecionado_opcion "
        ).innerHTML = select_optiones[i].innerHTML;
      }
      li[i].setAttribute("data-index", i);
      li[i].setAttribute("data-selec-index", e);
      // funcion click al selecionar
      li[i].addEventListener("click", function() {
        _select_option(
          this.getAttribute("data-index"),
          this.getAttribute("data-selec-index")
        );
      });

      li[i].innerHTML = select_optiones[i].innerHTML;
      ul_cont[0].appendChild(li[i]);
    } // Fin For select_optiones
  } // fin for divs_cont_select
} // Fin Function

////////

$("#person-select").click(function() {
  $(".person-select-container").toggle();
  $(".person-select-container").toggleClass("active");
});

////

$("#time-slot-select").click(function() {
  $(".time-slot-select-container").toggle();
  $(".time-slot-select-container").toggleClass("active");
});

$("#country-select").click(function() {
  $(".country-select-container").toggle();
  $(".country-select-container").toggleClass("active");
});

////
function create_custom_dropdowns() {
  $("select").each(function(i, select) {
    if (
      !$(this)
        .next()
        .hasClass("dropdown")
    ) {
      $(this).after(
        '<div class="dropdown ' +
          ($(this).attr("class") || "") +
          '" tabindex="0"><span class="current"></span><div class="list"><ul></ul></div></div>'
      );
      var dropdown = $(this).next();
      var options = $(select).find("option");
      var selected = $(this).find("option:selected");
      dropdown
        .find(".current")
        .html(selected.data("display-text") || selected.text());
      options.each(function(j, o) {
        var display = $(o).data("display-text") || "";
        dropdown
          .find("ul")
          .append(
            '<li class="option ' +
              ($(o).is(":selected") ? "selected" : "") +
              '" data-value="' +
              $(o).val() +
              '" data-display-text="' +
              display +
              '">' +
              $(o).text() +
              "</li>"
          );
      });
    }
  });
}

// Event listeners

// Open/close
$(document).on("click", ".dropdown", function(event) {
  $(".dropdown")
    .not($(this))
    .removeClass("open");
  $(this).toggleClass("open");
  if ($(this).hasClass("open")) {
    $(this)
      .find(".option")
      .attr("tabindex", 0);
    $(this)
      .find(".selected")
      .focus();
  } else {
    $(this)
      .find(".option")
      .removeAttr("tabindex");
    $(this).focus();
  }
});
// Close when clicking outside
$(document).on("click", function(event) {
  if ($(event.target).closest(".dropdown").length === 0) {
    $(".dropdown").removeClass("open");
    $(".dropdown .option").removeAttr("tabindex");
  }
  event.stopPropagation();
});
// Option click
$(document).on("click", ".dropdown .option", function(event) {
  $(this)
    .closest(".list")
    .find(".selected")
    .removeClass("selected");
  $(this).addClass("selected");
  var text = $(this).data("display-text") || $(this).text();
  $(this)
    .closest(".dropdown")
    .find(".current")
    .text(text);
  $(this)
    .closest(".dropdown")
    .prev("select")
    .val($(this).data("value"))
    .trigger("change");
});

// Keyboard events
$(document).on("keydown", ".dropdown", function(event) {
  var focused_option = $(
    $(this).find(".list .option:focus")[0] ||
      $(this).find(".list .option.selected")[0]
  );
  // Space or Enter
  if (event.keyCode == 32 || event.keyCode == 13) {
    if ($(this).hasClass("open")) {
      focused_option.trigger("click");
    } else {
      $(this).trigger("click");
    }
    return false;
    // Down
  } else if (event.keyCode == 40) {
    if (!$(this).hasClass("open")) {
      $(this).trigger("click");
    } else {
      focused_option.next().focus();
    }
    return false;
    // Up
  } else if (event.keyCode == 38) {
    if (!$(this).hasClass("open")) {
      $(this).trigger("click");
    } else {
      var focused_option = $(
        $(this).find(".list .option:focus")[0] ||
          $(this).find(".list .option.selected")[0]
      );
      focused_option.prev().focus();
    }
    return false;
    // Esc
  } else if (event.keyCode == 27) {
    if ($(this).hasClass("open")) {
      $(this).trigger("click");
    }
    return false;
  }
});


$(document).mouseup(function(e) {
    //container1
    var container1 = $(".person-select-container.active");
    if (!container1.is(e.target) && container1.has(e.target).length === 0){
        $(container1).toggle();
        $(container1).toggleClass("active");
    }
    //container2
    var container2 = $(".time-slot-select-container.active");
    if (!container2.is(e.target) && container2.has(e.target).length === 0){
        $(container2).toggle();
        $(container2).toggleClass("active");
    }
    //container3
    var container3 = $(".country-select-container.active");
    if (!container3.is(e.target) && container3.has(e.target).length === 0){
        $(container3).toggle();
        $(container3).toggleClass("active");
    }
});

$(document).ready(function() {
});

