let Token = null;

function ShowError(Message)
{
    const ErrorMessage = document.getElementById('ErrorMessage');
    ErrorMessage.textContent = Message;
    ErrorMessage.style.display = 'block';
}

function ShowSuccess(Message)
{
    const SuccessMessage = document.getElementById('SuccessMessage');
    SuccessMessage.textContent = Message;
    SuccessMessage.style.display = 'block';
}

async function HandleCreateWorld(Event)
{
    Event.preventDefault();

    const WorldName = document.getElementById('WorldName').value.trim();
    const RandomSeed = document.getElementById('RandomSeed').checked;
    const SeedInput = document.getElementById('Seed').value.trim();
    const WorldType = document.getElementById('WorldType').value;
    const CreateBtn = document.getElementById('CreateBtn');
    const Loading = document.getElementById('Loading');
    const ErrorMessage = document.getElementById('ErrorMessage');
    const SuccessMessage = document.getElementById('SuccessMessage');

    ErrorMessage.style.display = 'none';
    SuccessMessage.style.display = 'none';

    if (!WorldName)
    {
        ShowError('Введите название мира');
        return;
    }

    CreateBtn.style.display = 'none';
    Loading.style.display = 'block';

    try
    {
        const Response = await fetch('/api/worlds',
        {
            method: 'POST',
            headers:
            {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Token}`
            },
            body: JSON.stringify({
                name: WorldName,
                seed: RandomSeed ? '' : SeedInput,
                worldType: WorldType
            })
        });

        const Data = await Response.json();

        if (Response.ok)
        {
            SuccessMessage.textContent = 'Мир создан! Перенаправление...';
            SuccessMessage.style.display = 'block';

            window.location.href = '/world?worldId=' + Data.world.id;
        }
        else
        {
            ShowError(Data.error || 'Ошибка создания мира');
        }
    }
    catch (Error)
    {
        ShowError('Ошибка подключения');
        console.error('Create world error:', Error);
    }
    finally
    {
        CreateBtn.style.display = 'block';
        Loading.style.display = 'none';
    }
}

function HandleRandomSeedToggle(Event)
{
    const SeedInput = document.getElementById('Seed');
    SeedInput.disabled = Event.target.checked;
    if (Event.target.checked)
    {
        SeedInput.value = '';
    }
}

function InitCreateWorld()
{
    Token = localStorage.getItem('ls_token');

    if (!Token)
    {
        window.location.href = '/';
        return;
    }

    document.getElementById('CreateWorldForm').addEventListener('submit', HandleCreateWorld);
    document.getElementById('RandomSeed').addEventListener('change', HandleRandomSeedToggle);
    document.getElementById('BackBtn').addEventListener('click', () =>
    {
        window.location.href = '/menu';
    });
}

InitCreateWorld();
