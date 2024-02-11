const { TelegramClient, Api } = require("telegram");
const { StringSession } = require("telegram/sessions");
const input = require("input");
const dotenv = require("dotenv");
const fs = require("fs");

dotenv.config(); // fill this in with your own API credentials

const apiId = +process.env.APP_ID; // fill this in with your own API ID
const apiHash = process.env.APP_HASH; // fill this in with your own API HASH
const stringSession = new StringSession(''); // fill this later with the value from session.save()

(async () => {
  console.log("Loading interactive example...");
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });
  await client.start({
    phoneNumber: async () => await input.text("Please enter your number: "),
    password: async () => await input.text("Please enter your password: "),
    phoneCode: async () =>
      await input.text("Please enter the code you received: "),
    onError: (err) => console.log(err),
  });
  console.log("You should now be connected.");
  console.log(client.session.save()); // Save this string to avoid logging in again
  //await client.sendMessage("me", { message: "Hello!" });



    // const result = await client.invoke(
    //   new Api.channels.GetChannels({
    //     id: ["oopsfix"],
    //   })
    // );
    // console.log(result);
    const result = await client.invoke(
        new Api.messages.GetHistory({
          peer: "oopsfix",
        })
      );
      console.log(result); // prints the result

    // const result = await client.invoke(
    //     new Api.messages.GetHistory({
    //     peer: "oopsfix",
    //     limit: 100,
    //     maxId: 0,
    //     minId: 0,
    //     hash: BigInt("7297200579681077860"),
    //     })
    // );

    // const result = await client.invoke(
    //     new Api.updates.GetChannelDifference({
    //       channel: "username",
    //       filter: new Api.ChannelMessagesFilter({
    //         ranges: [
    //           new Api.MessageRange({
    //             minId: 0,
    //             maxId: 3,
    //           }),
    //         ],
    //         //excludeNewMessages: true,
    //       }),
    //       pts: 3,
    //       limit: 100,
    //       force: true,
    //     })
    //   );
    //   console.log(result); // prints the result

    // const result = await client.invoke(
    //     new Api.channels.ReadHistory({
    //       channel: "oopsfix",
    //       maxId: 0,
    //     })
    //   );

    // console.log(result);

    fs.writeFileSync("state_updates", JSON.stringify(result, null, 4)); // save the result to a file for later use
})();
