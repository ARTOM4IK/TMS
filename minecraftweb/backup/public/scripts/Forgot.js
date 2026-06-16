let EmailToReset = '';
let TempCode = '';

function ShowFieldError(ElementId, Message)
{
    const ErrorEl = document.getElementById(ElementId);
    ErrorEl.textContent = Message;
    ErrorEl.style.display = 'block';
}

function ShowFieldSuccess(ElementId, Message)
{
    const SuccessEl = document.getElementById(ElementId);
    SuccessEl.textContent = Message;
    SuccessEl.style.display = 'block';
}

function ShowStep(StepId)
{
    ['Step1', 'Step2', 'Step3', 'Step4'].forEach(Id =>
    {
        document.getElementById(Id).classList.toggle('Hidden', Id !== StepId);
    });
}

async function HandleForgot(Event)
{
    Event.preventDefault();

    const Email = document.getElementById('ForgotEmail').value.trim();
    const ForgotBtn = document.getElementById('ForgotBtn');
    const Loading = document.getElementById('Loading');
    const ErrorMessage = document.getElementById('ErrorMessage');
    const SuccessMessage = document.getElementById('SuccessMessage');

    ErrorMessage.style.display = 'none';
    SuccessMessage.style.display = 'none';

    ForgotBtn.style.display = 'none';
    Loading.style.display = 'block';

    try
    {
        const Response = await fetch('/api/forgot-password',
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: Email })
        });

        const Data = await Response.json();

        if (Response.ok)
        {
            EmailToReset = Email;
            ShowFieldSuccess('SuccessMessage', 'Код отправлен на почту');
            ShowStep('Step2');
        }
        else
        {
            ShowFieldError('ErrorMessage', Data.error || 'Ошибка');
        }
    }
    catch (Error)
    {
        ShowFieldError('ErrorMessage', 'Ошибка подключения');
        console.error('Forgot error:', Error);
    }
    finally
    {
        ForgotBtn.style.display = 'block';
        Loading.style.display = 'none';
    }
}

async function HandleVerify(Event)
{
    Event.preventDefault();

    const Code = document.getElementById('VerifyCode').value.trim();
    const VerifyBtn = document.getElementById('VerifyBtn');
    const Loading = document.getElementById('Loading2');
    const ErrorMessage = document.getElementById('VerifyErrorMessage');
    const SuccessMessage = document.getElementById('VerifySuccessMessage');

    ErrorMessage.style.display = 'none';
    SuccessMessage.style.display = 'none';

    VerifyBtn.style.display = 'none';
    Loading.style.display = 'block';

    try
    {
        const Response = await fetch('/api/reset-password',
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: EmailToReset, code: Code, password: 'temp' })
        });

        const Data = await Response.json();

        if (Response.ok)
        {
            TempCode = Code;
            ShowFieldSuccess('VerifySuccessMessage', 'Код верифицирован');
            ShowStep('Step3');
        }
        else
        {
            ShowFieldError('VerifyErrorMessage', Data.error || 'Неверный код');
        }
    }
    catch (Error)
    {
        ShowFieldError('VerifyErrorMessage', 'Ошибка');
    }
    finally
    {
        VerifyBtn.style.display = 'block';
        Loading.style.display = 'none';
    }
}

async function HandleReset(Event)
{
    Event.preventDefault();

    const NewPassword = document.getElementById('NewPassword').value;
    const ConfirmNewPassword = document.getElementById('ConfirmNewPassword').value;
    const ResetBtn = document.getElementById('ResetBtn');
    const Loading = document.getElementById('Loading3');
    const ErrorMessage = document.getElementById('ResetErrorMessage');
    const SuccessMessage = document.getElementById('ResetSuccessMessage');

    ErrorMessage.style.display = 'none';
    SuccessMessage.style.display = 'none';

    if (NewPassword !== ConfirmNewPassword)
    {
        ShowFieldError('ResetErrorMessage', 'Пароли не совпадают');
        return;
    }

    ResetBtn.style.display = 'none';
    Loading.style.display = 'block';

    try
    {
        const Response = await fetch('/api/reset-password',
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: EmailToReset,
                code: TempCode,
                password: NewPassword
            })
        });

        const Data = await Response.json();

        if (Response.ok)
        {
            ShowFieldSuccess('ResetSuccessMessage', 'Пароль изменен');
            ShowStep('Step4');
        }
        else
        {
            ShowFieldError('ResetErrorMessage', Data.error || 'Ошибка');
        }
    }
    catch (Error)
    {
        ShowFieldError('ResetErrorMessage', 'Ошибка подключения');
        console.error('Reset error:', Error);
    }
    finally
    {
        ResetBtn.style.display = 'block';
        Loading.style.display = 'none';
    }
}

function InitForgot()
{
    document.getElementById('ForgotForm').addEventListener('submit', HandleForgot);
    document.getElementById('VerifyForm').addEventListener('submit', HandleVerify);
    document.getElementById('ResetForm').addEventListener('submit', HandleReset);
}

InitForgot();
