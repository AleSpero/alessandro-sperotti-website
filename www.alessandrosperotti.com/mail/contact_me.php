<?php
header('Content-Type: application/json');

$log_file = __DIR__ . '/contact_log.txt';

function write_log($log_file, $msg) {
    $timestamp = date('Y-m-d H:i:s');
    file_put_contents($log_file, "[$timestamp] $msg\n", FILE_APPEND);
}

write_log($log_file, "--- New request ---");
write_log($log_file, "POST data: " . json_encode($_POST));

if (empty($_POST['name']) ||
    empty($_POST['email']) ||
    empty($_POST['message']) ||
    !filter_var($_POST['email'], FILTER_VALIDATE_EMAIL)) {
    write_log($log_file, "Validation failed - missing fields or invalid email");
    echo json_encode(["success" => false, "reason" => "validation"]);
    exit;
}

$name = strip_tags($_POST['name']);
$email_address = strip_tags($_POST['email']);
$message = strip_tags($_POST['message']);

$to = 'alessandro@sperodevs.com';
$email_subject = "Website Contact Form: $name";
$email_body = "You have received a new message from your website contact form.\n\n"
    . "Name: $name\n"
    . "Email: $email_address\n\n"
    . "Message:\n$message";
$headers = "From: noreply@alessandrosperotti.com\n";
$headers .= "Reply-To: $email_address";

write_log($log_file, "Sending mail to: $to, subject: $email_subject");

$sent = mail($to, $email_subject, $email_body, $headers);

write_log($log_file, "mail() returned: " . ($sent ? "true" : "false"));

if (!$sent) {
    $err = error_get_last();
    write_log($log_file, "Last error: " . json_encode($err));
}

echo json_encode(["success" => $sent]);
?>
