$(document).ready(function () {


    /* **** scrollIt ***** */
    $(function () {
        $.scrollIt({
            upKey: 38,
            downKey: 40,
            easing: "linear",
            scrollTime: 600,
            activeClass: "active",
            onPageChange: null,
            topOffset: -80,
        });
    });
    /* **** End scrollIt ***** */



    /* **** Navigation Toggle Start **** */
    $(".navbar-collapse a").click(function () {
        $(".navbar-collapse").collapse("hide");
    });
    /* **** Navigation Toggle End **** */

    /* **** Language Switcher **** */
    $(".lang-current").on("click", function (e) {
        e.stopPropagation();
        $(this).closest(".lang-switcher").toggleClass("open");
    });
    $(document).on("click", function () {
        $(".lang-switcher").removeClass("open");
    });
    $(".lang-dropdown a").on("click", function () {
        var href = $(this).attr("href");
        var lang = href.indexOf("/it/") !== -1 ? "it" : href.indexOf("/zh/") !== -1 ? "zh" : "en";
        localStorage.setItem("pref_lang", lang);
    });
    /* **** End Language Switcher **** */

    /* **** sticky **** */
    var ticking = false;
    $(window).on("scroll", function () {
        if (!ticking) {
            window.requestAnimationFrame(function () {
                if ($(window).scrollTop() > 150) {
                    $("header").addClass("nav-new");
                } else {
                    $("header").removeClass("nav-new");
                }
                ticking = false;
            });
            ticking = true;
        }
    });
    /* **** sticky **** */


    /* **** Lightbox **** */
    var lightbox = $("#lightbox");
    var lightboxImg = $("#lightbox-img");

    $(".project-screenshots img").on("click", function () {
        lightboxImg.attr("src", $(this).attr("src"));
        lightbox.addClass("active");
    });

    $(".lightbox-close, #lightbox").on("click", function (e) {
        if (e.target === this) {
            lightbox.removeClass("active");
        }
    });

    $(document).on("keydown", function (e) {
        if (e.key === "Escape") lightbox.removeClass("active");
    });
    /* **** End Lightbox **** */


    /* **** Contact Form **** */
    $("#contact-form").on("submit", function (e) {
        e.preventDefault();
        var $form = $(this);
        var $btn = $form.find("button[type=submit]");
        var $feedback = $("#form-feedback");
        var originalHtml = $btn.html();

        $btn.prop("disabled", true).html('<i class="fas fa-spinner fa-spin fa-fw"></i>');
        $feedback.hide().removeClass("form-success form-error");

        console.log("[ContactForm] Submitting to:", $form.attr("action"));
        console.log("[ContactForm] Data:", $form.serialize());

        $.ajax({
            url: $form.attr("action"),
            method: "POST",
            data: $form.serialize(),
            dataType: "json",
            success: function (res, textStatus, xhr) {
                console.log("[ContactForm] Response status:", xhr.status);
                console.log("[ContactForm] Response body:", res);
                if (res && res.success) {
                    $feedback.text($feedback.data("success"))
                             .addClass("form-success").fadeIn();
                    $form[0].reset();
                } else {
                    console.warn("[ContactForm] Server returned success=false, reason:", res && res.reason);
                    $feedback.text($feedback.data("error"))
                             .addClass("form-error").fadeIn();
                }
            },
            error: function (xhr, textStatus, errorThrown) {
                console.error("[ContactForm] AJAX error:", textStatus, errorThrown);
                console.error("[ContactForm] Response status:", xhr.status);
                console.error("[ContactForm] Response text:", xhr.responseText);
                $feedback.text($feedback.data("error"))
                         .addClass("form-error").fadeIn();
            },
            complete: function () {
                $btn.prop("disabled", false).html(originalHtml);
            }
        });
    });
    /* **** End Contact Form **** */
    
});
