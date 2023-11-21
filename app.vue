<template>
    <div>
        <div class="tabs">
            <NuxtLink class="home" to="/">Home</NuxtLink>
        </div>

        <NuxtPage />
    </div>
</template>

<style>
* {
    box-sizing: border-box;
}

.tabs {
    display: flex;
    border: 1px solid #ccc;
    background-color: #f1f1f1;
}

.tabs > * {
    background-color: inherit;
    border: none;
    outline: none;
    cursor: pointer;
    padding: 14px 16px;
    transition: 0.3s;
    text-decoration: none;
}

.tabs *:hover {
    background-color: #ddd;
}

.tabs *.active {
    background-color: #ccc;
}
</style>
