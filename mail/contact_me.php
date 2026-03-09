<?php
header('Content-Type: application/json');

if (empty($_POST['name']) ||
    empty($_POST['email']) ||
    empty($_POST['message']) ||
    !filter_var($_POST['email'], FILTER_VALIDATE_EMAIL)) {
    echo json_encode(["success" => false]);
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

$sent = mail($to, $email_subject, $email_body, $headers);
echo json_encode(["success" => $sent]);
?>
