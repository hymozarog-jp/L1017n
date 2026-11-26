(function () {
  "use strict";

  window.bindRobloxCheckoutVerification = function ({ input, client, onChange }) {
    const verify = document.createElement("button");
    verify.type = "button";
    verify.className = "btn btn-soft";
    verify.textContent = "تحقق من الحساب";

    const result = document.createElement("div");
    result.className = "roblox-verify-result";
    result.setAttribute("role", "status");
    input.after(verify, result);

    let verified = null;
    let revision = 0;
    let checking = false;
    let locked = false;
    const getUsername = () =>
      verified?.input === input.value.trim() ? verified.name : "";

    function showMessage(message, error = false) {
      result.className = "roblox-verify-result" + (error ? " error" : "");
      result.textContent = message;
    }

    input.addEventListener("input", () => {
      revision++;
      verified = null;
      showMessage("");
      onChange();
    });

    verify.addEventListener("click", async () => {
      if (checking || locked) return;
      const username = input.value.trim();
      const started = ++revision;
      verified = null;
      onChange();
      if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
        showMessage("اكتب اسم مستخدم Roblox صحيح من 3 إلى 20 حرف أو رقم أو _.", true);
        return;
      }

      checking = true;
      verify.disabled = true;
      showMessage("جارٍ التحقق من حساب Roblox…");
      const isCurrent = () =>
        input.isConnected && started === revision && input.value.trim() === username;
      try {
        if (!client) throw Error("تعذر الاتصال بالمتجر. حدّث الصفحة وحاول مرة ثانية.");
        const { data, error } = await client.functions.invoke("roblox-user-lookup", {
          body: { username },
        });
        if (!isCurrent()) return;
        if (error || !data || data.error) {
          throw Error("تعذر التحقق من حساب Roblox حالياً. جرّب مرة ثانية.");
        }
        if (!data.found || !data.id || !data.name) {
          showMessage("ما لقيناش حساب بهذا اليوزر. راجع اسم المستخدم وحاول مرة ثانية.", true);
          return;
        }

        showMessage("");
        if (data.avatar) {
          const avatar = document.createElement("img");
          avatar.src = data.avatar;
          avatar.alt = "صورة حساب Roblox";
          avatar.style.cssText = "width:44px;height:44px;padding:0;border-radius:50%;object-fit:cover;vertical-align:middle;margin-inline-end:8px";
          result.append(avatar);
        }
        const account = document.createElement("bdi");
        account.textContent = (data.displayName || data.name) + " · @" + data.name;
        result.append(account);
        const note = document.createElement("div");
        note.textContent = "تأكد إن هذا حسابك قبل تأكيد الشراء.";
        result.append(note);
        verified = { input: username, name: data.name };
      } catch (error) {
        if (isCurrent()) showMessage(error.message, true);
      } finally {
        checking = false;
        verify.disabled = locked;
        if (input.isConnected) onChange();
      }
    });

    return {
      getUsername,
      setLocked(value) {
        locked = value;
        input.readOnly = value;
        verify.disabled = value || checking;
      },
    };
  };
})();
