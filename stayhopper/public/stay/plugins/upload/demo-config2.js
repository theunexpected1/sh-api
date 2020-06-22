$(function() {
  $("#drag-and-drop-zone").dmUploader({
    //
    url: "/admin/photos/upload/" + property_id,
    maxFileSize: 10000000, // 3 Megs
    onDragEnter: function() {
      this.addClass("active");
    },
    onDragLeave: function() {
      this.removeClass("active");
    },
    onInit: function() {
      ui_add_log("Penguin initialized :)", "info");
    },
    onComplete: function() {
      ui_add_log("All pending tranfers finished");
    },
    onNewFile: function(id, file) {
      ui_add_log("New file added #" + id);
      ui_multi_add_file(id, file);
    },
    onBeforeUpload: function(id) {
      ui_add_log("Starting the upload of #" + id);
      ui_multi_update_file_status(id, "uploading", "Uploading...");
      ui_multi_update_file_progress(id, 0, "", true);
    },
    onUploadCanceled: function(id) {
      ui_multi_update_file_status(id, "warning", "Canceled by User");
      ui_multi_update_file_progress(id, 0, "warning", false);
    },
    onUploadProgress: function(id, percent) {
      ui_multi_update_file_progress(id, percent);
    },
    onUploadSuccess: function(id, data) {
      if (data.status == "ok") {
        setTimeout(function() {
          var html = ``;
          if (data.featured == true) {
            html =
              `
          <div class="col-sm-4">
            <div class="image--grid--tag">
              <span class="make_featured">FEATURED</span>
            </a>
        </div>
        <img src="/` +
              data.message +
              `" class="img-fluid" alt="image-grid">
       </div>
        `;
          } else {
            html =
              `
          <div class="col-sm-4">
            <div class="image--grid--tag">
              <span class="make_featured" data-image="` +
              data.message +
              `" data-id="` +
              property_id +
              `" onclick="make_featured(this)">MAKE FEATURED</span>
            <a class="remove-image" data-image="` +
              data.message +
              `" data-id="` +
              property_id +
              `" onclick="remove_image(this)">
                <span class="tag-close icon-cancel"></span>
            </a>
        </div>
        <img src="/` +
              data.message +
              `" class="img-fluid" alt="image-grid">
       </div>
        `;
          }
          $(".image--grid").append(html);
        }, 1000);
      }
      ui_add_log(
        "Server Response for file #" + id + ": " + JSON.stringify(data)
      );
      ui_add_log("Upload of file #" + id + " COMPLETED", "success");
      ui_multi_update_file_status(id, "success", "Upload Complete");
      ui_multi_update_file_progress(id, 100, "success", false);
    },
    onUploadError: function(id, xhr, status, message) {
      ui_multi_update_file_status(id, "danger", message);
      ui_multi_update_file_progress(id, 0, "danger", false);
    },
    onFallbackMode: function() {
      ui_add_log(
        "Plugin cant be used here, running Fallback callback",
        "danger"
      );
    },
    onFileSizeError: function(file) {
      ui_add_log(
        "File '" + file.name + "' cannot be added: size excess limit",
        "danger"
      );
    }
  });
});
