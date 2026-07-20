import nodemailer from "nodemailer";

const to = process.argv[2]?.trim() || "viva-r@yandex.ru";

const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  requireTLS: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

const from =
  process.env.SMTP_FROM?.trim() ||
  process.env.PASSWORD_RESET_EMAIL_FROM?.trim() ||
  "ТвойТренер <no-reply@xn--b1agaovdpdkd.xn--p1ai>";

const text = [
  "Здравствуйте!",
  "",
  "Настроена исходящая почта сайта через Yandex Cloud Postbox.",
  "",
  "От кого уходят письма сайта:",
  "  no-reply@твойтренер.рф",
  "",
  "Это НЕ почтовый ящик для входа. Postbox только ОТПРАВЛЯЕТ письма",
  "(сброс пароля, подтверждение email, уведомления о заказах).",
  "",
  "Читать и отвечать — в обычной Яндекс.Почте:",
  "  https://mail.yandex.ru/",
  "логин: viva-r@yandex.ru",
  "пароль: ваш обычный пароль Яндекса (или пароль приложения).",
  "",
  "Консоль Postbox (домен, DKIM, статистика):",
  "  https://console.yandex.cloud/folders/b1gcp1nnr8fk7o64thik/postbox/addresses",
  "",
  "SMTP уже прописан в .env сайта (не для ручного входа в почту):",
  "  сервер: postbox.cloud.yandex.net",
  "  порт: 587",
  "  логин/пароль: ID и секрет API-ключа сервисного аккаунта",
].join("\n");

const html = `<!DOCTYPE html>
<html lang="ru">
<body style="font-family:sans-serif;line-height:1.5;color:#111">
  <p>Здравствуйте!</p>
  <p>Настроена <b>исходящая</b> почта сайта через Yandex Cloud Postbox.</p>
  <p><b>От кого:</b> no-reply@твойтренер.рф</p>
  <p><b>Важно:</b> Postbox — не ящик для входа. Он только отправляет письма с сайта.</p>
  <p>Читать и отвечать:</p>
  <p><a href="https://mail.yandex.ru/">https://mail.yandex.ru/</a><br>
  логин: <code>viva-r@yandex.ru</code><br>
  пароль: ваш обычный пароль Яндекса</p>
  <p>Консоль Postbox:<br>
  <a href="https://console.yandex.cloud/folders/b1gcp1nnr8fk7o64thik/postbox/addresses">Адреса Postbox</a></p>
  <p>На сайте письма уходят автоматически: сброс пароля, подтверждение email, уведомления о заказах и событиях.</p>
</body>
</html>`;

const info = await transport.sendMail({
  from,
  to,
  subject: "ТвойТренер: как работает почта Postbox",
  text,
  html,
});

console.log("SENT", info.response, info.messageId);
